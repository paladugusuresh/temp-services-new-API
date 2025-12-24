#!/usr/bin/env node
import "dotenv/config";
import { readFileSync } from "fs";
import { pool } from "../src/db.js";

const sql = readFileSync("db/006_add_all_states.sql", "utf-8");

try {
  console.log("Running migration: 006_add_all_states.sql");
  const result = await pool.query(sql);
  console.log("✅ Migration complete!");
  console.log(`   Inserted/skipped ${result.rowCount || 0} states`);
} catch (err) {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
