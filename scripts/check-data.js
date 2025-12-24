// scripts/check-data.js
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('Checking database data...\n');

const services = await pool.query('SELECT COUNT(*) FROM services');
console.log(`✅ Services: ${services.rows[0].count}`);

const locations = await pool.query('SELECT COUNT(*) FROM locations WHERE is_active=true');
console.log(`✅ Active Locations: ${locations.rows[0].count}`);

const pricing = await pool.query('SELECT COUNT(*) FROM location_pricing');
console.log(`✅ Location Pricing Records: ${pricing.rows[0].count}`);

const cpi = await pool.query('SELECT COUNT(*) FROM macro_factors WHERE factor_type=\'CPI\'');
console.log(`✅ CPI Records: ${cpi.rows[0].count}`);

const baseline = await pool.query('SELECT year, period, value FROM macro_factors WHERE is_baseline=true LIMIT 1');
if (baseline.rows.length > 0) {
  console.log(`✅ CPI Baseline: ${baseline.rows[0].year}-${baseline.rows[0].period} = ${baseline.rows[0].value}`);
} else {
  console.log('❌ No CPI baseline set');
}

await pool.end();
