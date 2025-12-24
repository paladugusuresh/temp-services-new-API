// src/refresh.js
import { pool } from "./db.js";
import { fetchLatestCpi } from "./bls.js";
import { discoverSarppAllItemsLineCode, fetchStateRpp } from "./bea.js";

export async function runRefresh() {
  const cpiSeries = process.env.CPI_SERIES_ID || "CUUR0000SA0";
  const beaKey = process.env.BEA_API_KEY;

  if (!beaKey) throw new Error("Missing BEA_API_KEY env var");

  const startTime = Date.now();
  const stats = {
    cpi: null,
    rpp: null,
    updatedStates: 0,
    totalEstimates: 0,
    executionTimeMs: 0
  };

  console.log("🔄 Starting pricing data refresh...\n");

  // Begin transaction for atomicity
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1) CPI latest
    console.log(`📊 Fetching CPI series: ${cpiSeries}...`);
    const cpi = await fetchLatestCpi({ seriesId: cpiSeries });
    console.log(`✅ Latest CPI: ${cpi.year}-${cpi.period} = ${cpi.value}\n`);
    
    stats.cpi = { year: cpi.year, period: cpi.period, value: cpi.value };

    // Upsert latest CPI
    await client.query(
      `
      insert into macro_factors(factor_type, series_id, year, period, value, is_baseline)
      values ('CPI', $1, $2, $3, $4, false)
      on conflict (factor_type, series_id, year, period)
      do update set value=excluded.value, is_baseline=false, updated_at=now();
      `,
      [cpi.seriesId, cpi.year, cpi.period, cpi.value]
    );

    // Check if baseline exists; if not, set it to a fixed stable baseline
    const baselineCheck = await client.query(
      `select 1 from macro_factors where factor_type='CPI' and series_id=$1 and is_baseline=true limit 1`,
      [cpi.seriesId]
    );

    if (baselineCheck.rowCount === 0) {
      // Use stable baseline from env var or default to 2024-M01 (never changes)
      const baselineYear = parseInt(process.env.CPI_BASELINE_YEAR || '2024', 10);
      const baselinePeriod = process.env.CPI_BASELINE_PERIOD || 'M01';
      
      // Clear any old baseline flags first (prevent duplicates)
      await client.query(
        `update macro_factors set is_baseline = false 
         where factor_type='CPI' and series_id=$1`,
        [cpi.seriesId]
      );
      
      // Try to set the specified baseline
      const setBaseline = await client.query(
        `
        update macro_factors
        set is_baseline = true
        where factor_type='CPI' and series_id=$1 and year=$2 and period=$3
        returning year, period;
        `,
        [cpi.seriesId, baselineYear, baselinePeriod]
      );
      
      if (setBaseline.rowCount > 0) {
        console.log(`📌 Set CPI baseline to ${baselineYear}-${baselinePeriod} (from config)\n`);
      } else {
        // Baseline period not in DB yet, set earliest as fallback
        await client.query(
          `
          update macro_factors
          set is_baseline = true
          where factor_type='CPI' and series_id=$1 
          and (year, period) = (
            select year, period 
            from macro_factors 
            where factor_type='CPI' and series_id=$1 
            order by year asc, period asc 
            limit 1
          );
          `,
          [cpi.seriesId]
        );
        console.log(`⚠️  Baseline ${baselineYear}-${baselinePeriod} not found, using earliest record\n`);
      }
    }

    // 2) BEA RPP (states) - cache lineCode to avoid repeated discovery
    console.log("📍 Fetching BEA Regional Price Parities...");
    
    // Check if we have cached lineCode
    let lineCode = process.env.BEA_SARPP_LINECODE;
    if (!lineCode) {
      lineCode = await discoverSarppAllItemsLineCode({ apiKey: beaKey });
      console.log(`   Discovered SARPP LineCode: ${lineCode} (consider caching in env: BEA_SARPP_LINECODE)`);
    } else {
      console.log(`   Using cached SARPP LineCode: ${lineCode}`);
    }
    
    const rpp = await fetchStateRpp({ apiKey: beaKey, year: "LAST5", lineCode });
    console.log(`📅 Latest RPP year: ${rpp.latestYear}`);
    console.log(`✅ Loaded RPP for ${rpp.rows.length} state records\n`);
    
    stats.rpp = { year: rpp.latestYear, stateCount: rpp.rows.length };

    // Update states by matching GeoName -> state_name
    const unmatchedStates = [];
    for (const row of rpp.rows) {
      const geoName = String(row.GeoName || "").trim();
      const dataValue = Number(String(row.DataValue || "").replaceAll(",", ""));

      if (!geoName || !Number.isFinite(dataValue)) continue;

      const result = await client.query(
        `
        update locations
        set rpp_index=$1, rpp_year=$2, updated_at=now()
        where type='state' and state_name=$3
        returning slug;
        `,
        [dataValue, rpp.latestYear, geoName]
      );

      if (result.rowCount > 0) {
        console.log(`  ${geoName.padEnd(20)} RPP = ${dataValue.toFixed(1)}`);
        stats.updatedStates++;
      } else {
        unmatchedStates.push(geoName);
      }
    }

    console.log(`\n✅ Updated ${stats.updatedStates} states with RPP data`);
    
    if (unmatchedStates.length > 0) {
      console.log(`⚠️  WARNING: ${unmatchedStates.length} BEA states did not match any location:`);
      unmatchedStates.forEach(name => console.log(`   - ${name}`));
      console.log('   These states will use default RPP index of 100.0\n');
    } else {
      console.log('');
    }

    // Validate that we updated enough states (fail if too few matches)
    const MIN_EXPECTED_STATES = 45; // US has 50 states, allow some flexibility
    if (stats.updatedStates < MIN_EXPECTED_STATES) {
      throw new Error(
        `Refresh failed: Only ${stats.updatedStates} states updated (expected at least ${MIN_EXPECTED_STATES}). ` +
        `Unmatched states: ${unmatchedStates.join(', ')}`
      );
    }

    // 3) Recompute estimates
    console.log("🔢 Recomputing location pricing...");
    await client.query(`select recompute_location_pricing(null);`);
    
    const countResult = await client.query(`select count(*) from location_pricing;`);
    stats.totalEstimates = parseInt(countResult.rows[0].count, 10);
    
    console.log(`✅ Computed ${stats.totalEstimates} location/service estimates\n`);

    // Commit transaction
    await client.query('COMMIT');
    
    stats.executionTimeMs = Date.now() - startTime;
    console.log(`🎉 Refresh complete in ${stats.executionTimeMs}ms!`);
    
    return stats;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Refresh failed, rolling back transaction:', error);
    throw error;
  } finally {
    client.release();
  }
}
