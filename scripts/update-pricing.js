#!/usr/bin/env node
import "dotenv/config";
import { readFileSync } from "fs";
import { pool } from "../src/db.js";

console.log("💰 Updating national pricing for normalized services...\n");

try {
  const sql = readFileSync("db/003_seed_national_pricing.sql", "utf-8");
  await pool.query(sql);
  
  const result = await pool.query(`
    SELECT s.key, s.name, s.unit, np.low, np.typical, np.high
    FROM national_pricing np
    JOIN services s ON s.id = np.service_id
    ORDER BY s.key
  `);
  
  console.log(`✅ Updated ${result.rows.length} national pricing records:\n`);
  result.rows.forEach(r => {
    console.log(`  ${r.key.padEnd(25)} $${r.low}-$${r.typical}-$${r.high} per ${r.unit}`);
  });
  
  console.log("\n✅ National pricing updated!");
  
} catch (err) {
  console.error("❌ Failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
