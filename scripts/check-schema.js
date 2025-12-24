// scripts/check-schema.js
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(`
  SELECT column_name, data_type, is_nullable 
  FROM information_schema.columns 
  WHERE table_name = 'national_pricing' 
  ORDER BY ordinal_position
`);

console.table(rows);
await pool.end();
