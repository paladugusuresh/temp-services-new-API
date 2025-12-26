// src/index.js
import "dotenv/config";
import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { pool } from "./db.js";
import { runRefresh } from "./refresh.js";

const app = Fastify({ logger: true });

// Register Swagger (disabled in production unless explicitly enabled)
const enableSwagger = process.env.ENABLE_SWAGGER === 'true' || process.env.NODE_ENV !== 'production';

if (enableSwagger) {
  await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Temp Services API",
      description: "API for temporary service pricing estimates across US locations",
      version: "1.0.0"
    },
    servers: [
      {
        url: "https://temp-services-c3b6dtdzhag3ogbw.australiacentral-01.azurewebsites.net",
        description: "Production server"
      },
      {
        url: "http://localhost:8080",
        description: "Development server"
      }
    ],
    tags: [
      { name: "health", description: "Health check endpoints" },
      { name: "services", description: "Service information endpoints" },
      { name: "locations", description: "Location information endpoints" },
      { name: "estimates", description: "Pricing estimate endpoints" },
      { name: "admin", description: "Admin endpoints" }
    ]
  }
});

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false
    },
    staticCSP: true,
    transformStaticCSP: (header) => header
  });
  
  app.log.info('Swagger UI enabled at /docs');
} else {
  app.log.info('Swagger UI disabled (set ENABLE_SWAGGER=true to enable)');
}

// CORS (only needed if browser calls API directly - disable for SSR-only)
if (process.env.ENABLE_CORS === 'true') {
  const fastifyCors = (await import('@fastify/cors')).default;
  await app.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  });
  app.log.info(`CORS enabled for origin: ${process.env.CORS_ORIGIN || '*'}`);
}

app.get("/health", {
  schema: {
    tags: ["health"],
    description: "Health check endpoint",
    response: {
      200: {
        type: "object",
        properties: {
          ok: { type: "boolean" }
        }
      }
    }
  }
}, async () => ({ ok: true }));

app.get("/api/services", {
  schema: {
    tags: ["services"],
    description: "Get all available services",
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string", description: "Service key identifier" },
            name: { type: "string", description: "Service name" },
            unit: { type: "string", description: "Unit of measurement" }
          }
        }
      }
    }
  }
}, async () => {
  const { rows } = await pool.query(`select key, name, unit from services order by name;`);
  return rows;
});

app.get("/api/locations", {
  schema: {
    tags: ["locations"],
    description: "Get all active locations",
    response: {
      200: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slug: { type: "string", description: "Location slug identifier" },
            type: { type: "string", description: "Location type (state or city)" },
            state_code: { type: "string", description: "State code" },
            state_name: { type: "string", description: "State name" },
            city_name: { type: ["string", "null"], description: "City name" },
            rpp_index: { type: "number", description: "Regional Price Parity index" },
            rpp_year: { type: "integer", description: "RPP data year" }
          }
        }
      }
    }
  }
}, async () => {
  const { rows } = await pool.query(
    `select slug, type, state_code, state_name, city_name, rpp_index, rpp_year 
     from locations 
     where is_active=true 
     order by type, state_name, city_name nulls first;`
  );
  return rows;
});

app.get("/api/estimate", {
  schema: {
    tags: ["estimates"],
    description: "Get pricing estimate for a service at a location",
    querystring: {
      type: "object",
      required: ["service", "location"],
      properties: {
        service: { 
          type: "string", 
          description: "Service key (e.g., 'junk-removal', 'house-cleaning', 'plumber', 'electrician', 'handyman')",
          examples: ["junk-removal", "house-cleaning", "plumber", "electrician", "handyman", "lawn-mowing", "hvac"]
        },
        location: { 
          type: "string", 
          description: "Location slug (e.g., 'ca' for California state or 'ca-san-francisco' for city)",
          examples: ["ca", "ny", "tx", "ca-san-francisco", "ny-new-york"]
        }
      }
    },
    response: {
      200: {
        oneOf: [
          {
            type: "object",
            properties: {
              service_key: { type: "string" },
              service_name: { type: "string" },
              unit: { type: "string" },
              location_slug: { type: "string" },
              type: { type: "string" },
              state_code: { type: "string" },
              state_name: { type: "string" },
              city_name: { type: ["string", "null"] },
              low: { type: "number" },
              typical: { type: "number" },
              high: { type: "number" },
              inputs: { type: "object" },
              computed_at: { type: "string", format: "date-time" }
            }
          },
          {
            type: "object",
            properties: {
              error: { type: "string" }
            }
          }
        ]
      },
      404: {
        type: "object",
        properties: {
          error: { type: "string" }
        }
      }
    }
  }
}, async (req, reply) => {
  const { service, location } = req.query;
  
  console.log(`[DEBUG] /api/estimate called with service=${service}, location=${location}`);
  
  if (!service || !location) {
    reply.code(400);
    return { error: "service and location query params are required" };
  }

  // Validate service exists
  const serviceCheck = await pool.query(
    `select 1 from services where key=$1 limit 1`,
    [service]
  );
  
  if (serviceCheck.rowCount === 0) {
    reply.code(404);
    return { error: `Service '${service}' not found` };
  }

  // Validate location exists
  const locationCheck = await pool.query(
    `select 1 from locations where slug=$1 and is_active=true limit 1`,
    [location]
  );
  
  if (locationCheck.rowCount === 0) {
    reply.code(404);
    return { error: `Location '${location}' not found or inactive` };
  }

  // Get estimate
  const { rows } = await pool.query(
    `
    select s.key as service_key, s.name as service_name, s.unit,
           l.slug as location_slug, l.type, l.state_code, l.state_name, l.city_name,
           lp.low::text, lp.typical::text, lp.high::text, lp.inputs, lp.computed_at
    from location_pricing lp
    join services s on s.id=lp.service_id
    join locations l on l.id=lp.location_id
    where s.key=$1 and l.slug=$2
    limit 1;
    `,
    [service, location]
  );

  console.log(`[DEBUG] Query returned ${rows.length} rows`);
  if (rows.length > 0) {
    console.log(`[DEBUG] First row keys:`, Object.keys(rows[0]));
    console.log(`[DEBUG] First row:`, JSON.stringify(rows[0]));
  }
  
  if (rows.length === 0) {
    reply.code(404);
    return { error: "No estimate found. Run refresh job first." };
  }
  
  const result = rows[0];
  // Convert numeric strings to numbers for JSON serialization
  result.low = parseFloat(result.low);
  result.typical = parseFloat(result.typical);
  result.high = parseFloat(result.high);
  
  console.log(`[DEBUG] About to return result with converted numbers`);
  return result;
});

app.post("/admin/refresh", {
  schema: {
    tags: ["admin"],
    description: "Refresh pricing data for all services and locations (requires admin API key)",
    headers: {
      type: "object",
      required: ["x-admin-key"],
      properties: {
        "x-admin-key": { 
          type: "string", 
          description: "Admin API key for authentication" 
        }
      }
    },
    response: {
      200: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          message: { type: "string" },
          stats: {
            type: "object",
            properties: {
              cpi: {
                type: ["object", "null"],
                properties: {
                  year: { type: "number" },
                  period: { type: "string" },
                  value: { type: "number" }
                }
              },
              rpp: {
                type: ["object", "null"],
                properties: {
                  year: { type: "number" },
                  stateCount: { type: "number" }
                }
              },
              updatedStates: { type: "number" },
              totalEstimates: { type: "number" },
              executionTimeMs: { type: "number" }
            }
          }
        }
      },
      401: {
        type: "object",
        properties: {
          error: { type: "string" }
        }
      },
      500: {
        type: "object",
        properties: {
          error: { type: "string" }
        }
      }
    }
  }
}, async (req, reply) => {
  const apiKey = req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    reply.code(401);
    return { error: "Unauthorized" };
  }

  try {
    const stats = await runRefresh();
    return { 
      ok: true, 
      message: "Pricing data refreshed successfully",
      stats 
    };
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

// Graceful shutdown
const shutdown = async (signal) => {
  app.log.info(`Received ${signal}, closing server gracefully...`);
  
  try {
    await app.close();
    app.log.info('Server closed');
    
    await pool.end();
    app.log.info('Database pool closed');
    
    process.exit(0);
  } catch (err) {
    app.log.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
