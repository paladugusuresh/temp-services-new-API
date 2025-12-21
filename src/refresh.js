// src/refresh.js
import { pool } from "./db.js";
import { fetchLatestCpi } from "./bls.js";
import { discoverSarppAllItemsLineCode, fetchStateRpp } from "./bea.js";

export async function runRefresh() {
  const cpiSeries = process.env.CPI_SERIES_ID || "CUUR0000SA0";
  const beaKey = process.env.BEA_API_KEY;

  if (!beaKey) throw new Error("Missing BEA_API_KEY env var");

  console.log("🔄 Starting pricing data refresh...\n");

  // 1) CPI latest
  console.log(`📊 Fetching CPI series: ${cpiSeries}...`);
  const cpi = await fetchLatestCpi({ seriesId: cpiSeries });
  console.log(`✅ Latest CPI: ${cpi.year}-${cpi.period} = ${cpi.value}\n`);

  // Upsert latest CPI
  await pool.query(
    `
    insert into macro_factors(factor_type, series_id, year, period, value, is_baseline)
    values ('CPI', $1, $2, $3, $4, false)
    on conflict (factor_type, series_id, year, period)
    do update set value=excluded.value, is_baseline=false, updated_at=now();
    `,
    [cpi.seriesId, cpi.year, cpi.period, cpi.value]
  );

  // If no baseline exists, set baseline = first CPI we ever stored
  const baselineCheck = await pool.query(
    `select 1 from macro_factors where factor_type='CPI' and series_id=$1 and is_baseline=true limit 1`,
    [cpi.seriesId]
  );

  if (baselineCheck.rowCount === 0) {
    await pool.query(
      `
      update macro_factors
      set is_baseline = true
      where factor_type='CPI' and series_id=$1 and year=$2 and period=$3;
      `,
      [cpi.seriesId, cpi.year, cpi.period]
    );
    console.log(`📌 Set CPI baseline: ${cpi.year}-${cpi.period}\n`);
  }

  // 2) BEA RPP (states)
  console.log("📍 Fetching BEA Regional Price Parities...");
  const lineCode = await discoverSarppAllItemsLineCode({ apiKey: beaKey });
  console.log(`   Discovered SARPP LineCode: ${lineCode}`);
  
  const rpp = await fetchStateRpp({ apiKey: beaKey, year: "LAST5", lineCode });
  console.log(`📅 Latest RPP year: ${rpp.latestYear}`);
  console.log(`✅ Loaded RPP for ${rpp.rows.length} state records\n`);

  // Update states by matching GeoName -> state_name
  let updatedStates = 0;
  for (const row of rpp.rows) {
    const geoName = String(row.GeoName || "").trim();
    const dataValue = Number(String(row.DataValue || "").replaceAll(",", ""));

    if (!geoName || !Number.isFinite(dataValue)) continue;

    const result = await pool.query(
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
      updatedStates++;
    }
  }

  console.log(`\n✅ Updated ${updatedStates} states with RPP data\n`);

  // 3) Recompute estimates
  console.log("🔢 Recomputing location pricing...");
  await pool.query(`select recompute_location_pricing(null);`);
  
  const countResult = await pool.query(`select count(*) from location_pricing;`);
  const totalEstimates = countResult.rows[0].count;
  
  console.log(`✅ Computed ${totalEstimates} location/service estimates\n`);
  console.log("🎉 Refresh complete!");
}
