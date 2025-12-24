import "dotenv/config";
import { pool } from "../src/db.js";

const service = "moving-help";
const location = "fl";

console.log(`\nChecking estimate for service='${service}' location='${location}'...\n`);

// Check service exists
const svc = await pool.query(`SELECT id, key, name FROM services WHERE key=$1`, [service]);
console.log("Service:", svc.rows[0] || "NOT FOUND");

// Check location exists
const loc = await pool.query(`SELECT id, slug, state_name FROM locations WHERE slug=$1 AND is_active=true`, [location]);
console.log("Location:", loc.rows[0] || "NOT FOUND");

// Check pricing exists
if (svc.rows[0] && loc.rows[0]) {
  const pricing = await pool.query(
    `SELECT * FROM location_pricing WHERE service_id=$1 AND location_id=$2`,
    [svc.rows[0].id, loc.rows[0].id]
  );
  console.log("Pricing record:", pricing.rows[0] || "NOT FOUND");
}

// Try the actual query from the API
const { rows } = await pool.query(
  `
  SELECT s.key as service_key, s.name as service_name, s.unit,
         l.slug as location_slug, l.type, l.state_code, l.state_name, l.city_name,
         lp.low, lp.typical, lp.high, lp.inputs, lp.computed_at
  FROM location_pricing lp
  JOIN services s ON s.id=lp.service_id
  JOIN locations l ON l.id=lp.location_id
  WHERE s.key=$1 AND l.slug=$2
  LIMIT 1;
  `,
  [service, location]
);

console.log("\nAPI Query Result:", rows[0] || "NO RESULTS");
console.log("\nRow count:", rows.length);

await pool.end();
