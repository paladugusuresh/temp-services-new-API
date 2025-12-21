# Temp Services - REST API

Fastify REST API serving pricing estimates based on BEA Regional Price Parities and BLS Consumer Price Index.

## 📋 Overview

- **Framework**: Fastify 4.29
- **Database**: PostgreSQL (Neon)
- **Data Sources**: 
  - Bureau of Economic Analysis (BEA) - Regional Price Parities
  - Bureau of Labor Statistics (BLS) - Consumer Price Index
- **Runtime**: Node.js 18+

## 🚀 Quick Start

### Development

```bash
npm install

# Set environment variables
export DATABASE_URL='postgresql://...'
export BEA_API_KEY='...'
export CPI_SERIES_ID='CUUR0000SA0'
export ADMIN_API_KEY='dev-admin-key-12345'
export PORT='8080'

npm start
# API runs at http://localhost:8080
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
│   ├── index.js       # Fastify server with 5 endpoints
│   ├── bea.js         # BEA RPP data fetcher
│   ├── bls.js         # BLS CPI data fetcher
│   ├── db.js          # PostgreSQL connection pool
│   ├── refresh.js     # Monthly data refresh orchestrator
│   └── refresh-cli.js # CLI for manual refresh
├── db/                # SQL migration files
│   ├── 001_schema.sql
│   ├── 002_seed_services.sql
│   ├── 003_seed_national_pricing.sql
│   ├── 004_seed_locations.sql
│   └── 005_add_more_states.sql
└── package.json
```

## 🌐 API Endpoints

### Public Endpoints

#### `GET /health`
Health check
```json
{ "status": "ok" }
```

#### `GET /api/services`
List all 15 services
```json
[
  {
    "key": "junk-removal",
    "name": "Junk Removal",
    "slug_cost": "junk-removal-cost"
  },
  ...
]
```

#### `GET /api/locations`
List all 15 states with RPP data
```json
[
  {
    "slug": "ca",
    "name": "California",
    "rpp": 112.6,
    "geofips": "STATE"
  },
  ...
]
```

#### `GET /api/estimate?service=junk-removal&location=ca`
Get pricing estimate for a service in a state
```json
{
  "service": "junk-removal",
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

- **services** (15 records) - Service definitions
- **locations** (15 records) - States with RPP indices
- **national_pricing** (15 records) - Angi baseline pricing
- **macro_factors** (1 record) - Latest CPI data
- **location_pricing** (225 records) - Computed estimates

### Pricing Formula

```
state_price = national_baseline × (RPP/100) × (CPI_latest/CPI_baseline)
```

Example:
- National junk removal: $150-$600
- California RPP: 112.6
- CPI baseline: 304.127 (Jan 2024)
- CPI latest: 324.122 (Nov 2025)
- **California estimate**: $180-$720

## ⚙️ Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
BEA_API_KEY=your-bea-api-key
CPI_SERIES_ID=CUUR0000SA0
ADMIN_API_KEY=your-secret-admin-key

# Optional
PORT=8080
```

### Get API Keys

- **BEA API Key**: Register at https://apps.bea.gov/api/signup/
- **BLS Data**: Public API, no key needed
- **Database**: Neon Postgres at https://neon.tech

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
    CPI_SERIES_ID='CUUR0000SA0' \
    ADMIN_API_KEY='...' \
    PORT='8080'
```

### Deploy

```bash
az webapp deploy \
  --name temp-services-api \
  --resource-group temp-services-rg \
  --src-path . \
  --type zip
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
