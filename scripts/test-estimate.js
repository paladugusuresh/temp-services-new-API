// scripts/test-estimate.js
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const result = await pool.query(`
  SELECT s.key, l.slug, lp.low, lp.typical, lp.high
  FROM location_pricing lp
  JOIN services s ON s.id=lp.service_id
  JOIN locations l ON l.id=lp.location_id
  WHERE s.key='plumber' AND l.slug='ca'
`);

console.log('Query result:', result.rowCount, 'rows');
console.log(result.rows);

await pool.end();
