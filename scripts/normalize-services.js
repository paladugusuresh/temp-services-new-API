#!/usr/bin/env node
import "dotenv/config";
import { readFileSync } from "fs";
import { pool } from "../src/db.js";

console.log("🔧 Normalizing services...\n");

try {
  // Get current services
  const before = await pool.query("SELECT key, name, unit FROM services ORDER BY key");
  console.log(`📊 Current services: ${before.rows.length}\n`);

  // Run migration
  const sql = readFileSync("db/007_normalize_services.sql", "utf-8");
  await pool.query(sql);
  
  // Get updated services
  const after = await pool.query("SELECT key, name, unit FROM services ORDER BY key");
  console.log(`✅ Updated services: ${after.rows.length}\n`);
  
  console.log("Services after normalization:");
  after.rows.forEach(s => {
    console.log(`  ${s.key.padEnd(25)} ${s.name.padEnd(30)} unit: ${s.unit}`);
  });
  
  const deleted = before.rows.length - after.rows.length;
  if (deleted > 0) {
    console.log(`\n🗑️  Deleted ${deleted} duplicate services`);
  }
  
  console.log("\n✅ Migration complete!");
  console.log("⚠️  Remember to run: npm run refresh");
  
} catch (err) {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
