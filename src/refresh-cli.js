#!/usr/bin/env node
// src/refresh-cli.js
import "dotenv/config";
import { runRefresh } from "./refresh.js";
import { pool } from "./db.js";

(async () => {
  try {
    await runRefresh();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Refresh failed:", err.message);
    await pool.end();
    process.exit(1);
  }
})();
