# Temp Services - REST API

Fastify REST API serving pricing estimates based on BEA Regional Price Parities and BLS Consumer Price Index.

## 📋 Overview

- **Framework**: Fastify 4.29
- **Database**: PostgreSQL (Neon)
- **Data Sources**: 
  - Bureau of Economic Analysis (BEA) - Regional Price Parities
  - Bureau of Labor Statistics (BLS) - Consumer Price Index
- **Runtime**: Node.js 18+
- **Documentation**: Swagger UI at `/docs`

## 🚀 Quick Start

### Development

```bash
npm install

# Set environment variables
export DATABASE_URL='postgresql://...'
export BEA_API_KEY='...'
export CPI_SERIES_ID='CUUR0000SA0'
export ADMIN_API_KEY='dev-admin-key-12345'
export BEA_SARPP_LINECODE='1'  # Optional: cache to avoid API calls
export PORT='8080'

# Setup database
npm run db:setup

npm start
# API runs at http://localhost:8080
# Swagger UI: http://localhost:8080/docs
```

### Watch Mode

```bash
npm run dev
# Uses node --watch for auto-reload
```

## 📁 Structure

```
temp-services-api/
├── src/
│   ├── index.js       # Fastify server with 5 endpoints + Swagger
│   ├── bea.js         # BEA RPP data fetcher
│   ├── bls.js         # BLS CPI data fetcher
│   ├── db.js          # PostgreSQL connection pool
│   ├── refresh.js     # Monthly data refresh orchestrator (transactional)
│   └── refresh-cli.js # CLI for manual refresh
├── db/                # SQL migration files
│   ├── 001_schema.sql              # Core schema + recompute function
│   ├── 002_seed_services.sql       # 15 temp services
│   ├── 003_seed_national_pricing.sql # Baseline US prices
│   ├── 004_seed_locations.sql      # Initial 7 states
│   └── 005_add_more_states.sql     # Additional 8 states
├── webjobs/
│   └── refresh/
│       ├── run.sh              # WebJob runner script
│       └── settings.job        # Schedule (monthly, singleton)
└── package.json
```

## 🌐 API Endpoints

### Public Endpoints

#### `GET /health`
Health check
```json
{ "ok": true }
```

#### `GET /api/services`
List all services with keys, names, and units
```json
[
  {
    "key": "junk-removal",
    "name": "Junk Removal",
    "unit": "per load"
  },
  {
    "key": "plumber",
    "name": "Plumber",
    "unit": "per hour"
  }
]
```

#### `GET /api/locations`
List all active locations with RPP indices
```json
[
  {
    "slug": "ca",
    "type": "state",
    "state_code": "CA",
    "state_name": "California",
    "city_name": null,
    "rpp_index": 112.60,
    "rpp_year": 2024
  }
]
```

#### `GET /api/estimate?service=junk-removal&location=ca`
Get pricing estimate for a service in a location
```json
{
  "service_key": "junk-removal",
  "service_name": "Junk Removal",
  "unit": "per load",
  "location_slug": "ca",
  "type": "state",
  "state_code": "CA",
  "state_name": "California",
  "city_name": null,
  "low": 168.90,
  "typical": 337.80,
  "high": 675.60,
  "inputs": {
    "national_low": 150.00,
    "national_typical": 300.00,
    "national_high": 600.00,
    "cpi_baseline": 307.789,
    "cpi_current": 307.789,
    "cpi_ratio": 1.0,
    "rpp_index": 112.60,
    "adjustment_factor": 1.126
  },
  "computed_at": "2024-12-20T10:30:00Z"
}
```

**Validation**: Returns 404 if service or location not found, 400 if parameters missing.

### Admin Endpoints

#### `POST /admin/refresh`
Refresh all pricing data (requires `x-admin-key` header)

**Headers**: 
```
x-admin-key: your-admin-key-here
```

**Response**:
```json
{
  "ok": true,
  "message": "Pricing data refreshed successfully",
  "stats": {
    "cpi": {
      "year": 2024,
      "period": "M11",
      "value": 307.789
    },
    "rpp": {
      "year": 2024,
      "stateCount": 51
    },
    "updatedStates": 15,
    "totalEstimates": 225,
    "executionTimeMs": 3421
  }
}
```
  "location": "ca",
  "estimate_low": 200,
  "estimate_high": 800,
  "adjusted_at": "2025-12-20T..."
}
```

### Admin Endpoints

#### `POST /admin/refresh`
Trigger monthly data refresh

**Headers:**
```
x-admin-key: YOUR_ADMIN_API_KEY
```

**Response:**
```json
{
  "success": true,
  "message": "Refresh complete",
  "cpi_count": 1,
  "rpp_count": 15,
  "estimates_count": 225
}
```

## 🗄️ Database Schema

### Tables

After running `npm run db:setup`:

- **services** (15 records) - Service definitions
- **locations** (15 records) - States with RPP indices (7 initial + 8 additional)
- **national_pricing** (15 records) - Internal baseline pricing ranges
- **macro_factors** (grows monthly) - CPI time series data
- **location_pricing** (225 records) - Computed estimates (15 services × 15 states)

**Note**: `db:setup` runs all migrations including 005_add_more_states.sql to ensure all 15 states are seeded.

### Pricing Formula

```
adjusted_price = national_baseline × (RPP_index/100) × (CPI_current/CPI_baseline)
```

Example:
- National junk removal: $300 (typical)
- California RPP: 112.6
- CPI ratio: 1.0 (current month)
- **California estimate**: $300 × 1.126 × 1.0 = $338

**Pricing Methodology**: Estimates are based on CPI and RPP adjustments applied to internal baseline ranges. Not affiliated with or based on quotes from third-party providers.

## ⚙️ Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
BEA_API_KEY=your-bea-api-key
ADMIN_API_KEY=your-secret-admin-key

# Recommended
CPI_SERIES_ID=CUUR0000SA0                    # BLS CPI series (US All Urban)
CPI_BASELINE_YEAR=2024                       # Stable baseline year (never change after setting)
CPI_BASELINE_PERIOD=M01                      # Baseline period (M01 = January)
BEA_SARPP_LINECODE=1                         # Cache for "All items RPP" (speeds up refresh)

# Optional
PORT=8080
NODE_ENV=production                          # Controls Swagger (disabled in prod)
ENABLE_SWAGGER=true                          # Force enable Swagger (overrides NODE_ENV)
ENABLE_CORS=true                             # Enable CORS for browser calls (SSR doesn't need this)
CORS_ORIGIN=https://your-frontend.com        # Restrict CORS origin (default: *)
```

### Get API Keys

- **BEA API Key**: Register at https://apps.bea.gov/api/signup/
- **BLS Data**: Public API, no key needed
- **Database**: Neon Postgres at https://neon.tech

### Production Configuration Notes

**CPI Baseline Stability**: Set `CPI_BASELINE_YEAR` and `CPI_BASELINE_PERIOD` once and never change. This ensures pricing calculations remain consistent across database reseeds.

**Swagger in Production**: Disabled by default when `NODE_ENV=production`. Set `ENABLE_SWAGGER=true` to force enable (not recommended for public APIs).

**CORS**: Only needed if your frontend makes direct browser calls to the API. Server-side rendering (SSR) with Next.js doesn't need CORS.

## 🔄 Data Refresh Schedule

### Monthly Refresh (2nd day of month, 3:15 AM UTC)

New BLS CPI data is released ~13th of each month (for previous month).
BEA RPP data is annual (updates in May/June).

**Recommended schedule**: Run on 2nd day to capture any early updates.

### Azure Setup

**Option 1: WebJob**
```bash
# Upload refresh-webjob.sh to Azure WebJobs
curl -X POST https://temp-services-api.azurewebsites.net/admin/refresh \
  -H "x-admin-key: $ADMIN_API_KEY"
```

**Option 2: Logic App**
- Trigger: Recurrence (Monthly, Day 2, 03:15 UTC)
- Action: HTTP POST to `/admin/refresh`
- Headers: `x-admin-key`

## 🚢 Deployment to Azure App Service

### Production Readiness Fixes (December 2024)

All critical production issues have been addressed:

✅ **1. Database Migrations Complete**
- All SQL files (001-005) now in source control
- Schema includes `recompute_location_pricing()` function
- Services, locations, and baseline pricing seeded

✅ **2. WebJob Singleton Mode**
- `is_singleton: true` prevents duplicate runs when scaled out
- Schedule set to 1st of month: `"0 15 3 1 * *"`
- Requires Always On enabled in App Service

✅ **3. Transactional Refresh**
- Full BEGIN/COMMIT/ROLLBACK wrapper
- Prevents partial updates on failure
- Client pooling with proper release

✅ **4. Stable CPI Baseline**
- Baseline set to earliest CPI record (not latest)
- Survives database reseeds
- Prevents ratio drift

✅ **5. Enhanced Admin Stats**
- Returns CPI year/period/value
- Returns RPP year and state count
- Returns updated states count
- Returns total estimates count
- Returns execution time in milliseconds

✅ **6. Graceful Shutdown**
- SIGTERM/SIGINT handlers
- Closes Fastify server cleanly
- Ends PostgreSQL pool properly

✅ **7. Input Validation**
- Validates service exists (404 if not found)
- Validates location exists and is active
- Proper HTTP status codes (400/404 instead of generic errors)

✅ **8. BEA LineCode Caching**
- Supports `BEA_SARPP_LINECODE` env var
- Avoids redundant API discovery calls
- Falls back to dynamic discovery if not set

### Create App Service

```bash
az group create --name temp-services-rg --location eastus

az appservice plan create \
  --name temp-services-plan \
  --resource-group temp-services-rg \
  --sku B1 \
  --is-linux

az webapp create \
  --name temp-services-api \
  --resource-group temp-services-rg \
  --plan temp-services-plan \
  --runtime "NODE:18-lts"
```

### Configure Environment

```bash
az webapp config appsettings set \
  --name temp-services-api \
  --resource-group temp-services-rg \
  --settings \
    DATABASE_URL='postgresql://...' \
    BEA_API_KEY='...' \
    BEA_SARPP_LINECODE='1' \
    CPI_SERIES_ID='CUUR0000SA0' \
    ADMIN_API_KEY='...' \
    PORT='8080'

# Enable Always On for WebJobs
az webapp config set \
  --name temp-services-api \
  --resource-group temp-services-rg \
  --always-on true
```

### Deploy

```bash
# Zip deployment
zip -r deploy.zip . -x "node_modules/*" ".git/*"

az webapp deploy \
  --name temp-services-api \
  --resource-group temp-services-rg \
  --src-path deploy.zip \
  --type zip
```

### Setup WebJob (Scheduled Monthly Refresh)

The WebJob configuration is already in `webjobs/refresh/`:

```json
{
  "schedule": "0 15 3 1 * *",
  "is_singleton": true
}
```

**Cron format**: `sec min hour day month day-of-week`
- Runs: 1st of every month at 03:15:00 UTC
- `is_singleton` ensures only one instance runs across scale-out scenarios

Deploy WebJob:
```bash
cd webjobs/refresh
zip refresh.zip run.sh settings.job
az webapp deployment source config-zip \
  --name temp-services-api \
  --resource-group temp-services-rg \
  --src refresh.zip \
  --webJob refresh \
  --webJobType scheduled
```

### Or Use GitHub Actions

```yaml
name: Deploy API
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: azure/webapps-deploy@v2
        with:
          app-name: 'temp-services-api'
          publish-profile: ${{ secrets.AZURE_API_PUBLISH_PROFILE }}
          package: '.'
```

## 🔧 Database Setup

### Initial Setup (Already Done)

```bash
# 1. Create tables and functions
npm run db:schema

# 2. Seed services
npm run db:seed-services

# 3. Seed national pricing
npm run db:seed-pricing

# 4. Seed locations (states)
npm run db:seed-locations

# Or run all at once
npm run db:setup
```

### Manual Refresh

```bash
npm run refresh
```

## 📊 Data Coverage

- **States**: 15 (CA, TX, FL, NY, IL, PA, GA, WA, MA, AZ, CO, NC, OH, MI, VA)
- **Services**: 15 (junk removal, electrician, plumbing, etc.)
- **Estimates**: 225 (15 × 15)
- **Update Frequency**: Monthly (via `/admin/refresh`)

## 📝 Scripts

- `npm start` - Start production server
- `npm run dev` - Start with watch mode
- `npm run refresh` - Manual data refresh
- `npm run db:setup` - Initialize database (run once)

## 🔗 Related

- **Web Repository**: [temp-services-web](../temp-services-web)
- **Documentation**: See `/db` folder for schema details
