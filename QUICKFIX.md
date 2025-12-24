# Quick Fix Reference

## Service Keys (UI ↔️ API Must Match)

```
✅ junk-removal      (not junk-removal-cost)
✅ house-cleaning    (not house_cleaning or house-cleaner-hourly)
✅ lawn-mowing       (not lawn-mowing-visit)
✅ snow-removal      (not snow-removal-visit)
✅ handyman          (not handyman-hourly)
✅ plumber           (not plumber-hourly)
✅ electrician       (not electrician-hourly)
✅ hvac              (not hvac-tech-hourly)
✅ moving            (not moving-service-hourly)
✅ pest-control      (not pest-control-visit)
✅ painting          (not painter-hourly)
✅ roofing           (not roofer-hourly)
✅ carpentry         (not carpenter-hourly)
✅ landscaping       (not landscaper-hourly)
✅ pet-sitting       (not pet-sitting-daily)
```

## Environment Variables

```bash
# Stability (REQUIRED in production)
CPI_BASELINE_YEAR=2024
CPI_BASELINE_PERIOD=M01
BEA_SARPP_LINECODE=1

# Security (RECOMMENDED)
NODE_ENV=production        # Disables Swagger
ENABLE_SWAGGER=false       # Explicit disable
ENABLE_CORS=false          # Use SSR, not browser calls

# Core (REQUIRED)
DATABASE_URL=postgresql://...
BEA_API_KEY=...
ADMIN_API_KEY=...
```

## Test Commands

```bash
# Verify service keys
curl http://localhost:8080/api/services | jq '.[].key'

# Test estimate (should work)
curl "http://localhost:8080/api/estimate?service=junk-removal&location=ca"

# Test invalid (should 404)
curl "http://localhost:8080/api/estimate?service=plumber-hourly&location=ca"
```

## Common Mistakes

❌ `service=plumber-hourly` → Use `service=plumber`  
❌ `service=house-cleaner-hourly` → Use `service=house-cleaning`  
❌ `service=junk-removal-cost` → Use `service=junk-removal`

## Files Changed

```
db/002_seed_services.sql        - Service keys updated
db/003_seed_national_pricing.sql - Pricing keys updated
src/index.js                    - Swagger + CORS conditional
src/refresh.js                  - Stable CPI baseline
README.md                       - Correct examples
DEPLOYMENT.md                   - WebJob instructions
package.json                    - Added @fastify/cors
```

## Deploy Checklist

1. ✅ Reseed database with new service keys
2. ✅ Set environment variables (baseline, swagger, cors)
3. ✅ Deploy WebJob explicitly (not automatic)
4. ✅ Test `/api/services` returns correct keys
5. ✅ Test `/api/estimate` with UI service keys
6. ✅ Verify UI uses exact same keys
