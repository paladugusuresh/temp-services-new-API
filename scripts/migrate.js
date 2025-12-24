// scripts/migrate.js
import { readFileSync } from 'fs';
import pg from 'pg';

const { Pool } = pg;

const migrations = [
  'db/000_add_source_column.sql',
  'db/001_schema.sql',
  'db/002_seed_services.sql',
  'db/003_seed_national_pricing.sql',
  'db/004_seed_locations.sql',
  'db/005_add_more_states.sql'
];

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    console.error('\nPlease set it to your Neon connection string:');
    console.error('  $env:DATABASE_URL = "postgresql://user:pass@host/db"');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('🚀 Starting database migrations...\n');

    for (const file of migrations) {
      console.log(`📄 Running: ${file}`);
      const sql = readFileSync(file, 'utf8');
      await pool.query(sql);
      console.log(`✅ Completed: ${file}\n`);
    }

    console.log('✅ All migrations completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
