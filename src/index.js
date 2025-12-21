// src/index.js
import Fastify from "fastify";
import { pool } from "./db.js";
import { runRefresh } from "./refresh.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true }));

app.get("/api/services", async () => {
  const { rows } = await pool.query(`select key, name, unit from services order by name;`);
  return rows;
});

app.get("/api/locations", async () => {
  const { rows } = await pool.query(
    `select slug, type, state_code, state_name, city_name, rpp_index, rpp_year 
     from locations 
     where is_active=true 
     order by type, state_name, city_name nulls first;`
  );
  return rows;
});

app.get("/api/estimate", async (req) => {
  const { service, location } = req.query;
  if (!service || !location) {
    return { error: "service and location query params are required" };
  }

  const { rows } = await pool.query(
    `
    select s.key as service_key, s.name as service_name, s.unit,
           l.slug as location_slug, l.type, l.state_code, l.state_name, l.city_name,
           lp.low, lp.typical, lp.high, lp.inputs, lp.computed_at
    from location_pricing lp
    join services s on s.id=lp.service_id
    join locations l on l.id=lp.location_id
    where s.key=$1 and l.slug=$2
    limit 1;
    `,
    [service, location]
  );

  if (rows.length === 0) {
    return { error: "No estimate found. Run refresh job first." };
  }
  
  return rows[0];
});

app.post("/admin/refresh", async (req, reply) => {
  const apiKey = req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    reply.code(401);
    return { error: "Unauthorized" };
  }

  try {
    await runRefresh();
    return { ok: true, message: "Pricing data refreshed successfully" };
  } catch (err) {
    reply.code(500);
    return { error: err.message };
  }
});

const port = Number(process.env.PORT || 8080);
app.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
