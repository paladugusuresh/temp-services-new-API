# Production Deployment Checklist

## ✅ Pre-Deployment Verification

### 1. Database Setup
- [ ] PostgreSQL database created (Neon/Azure/AWS RDS)
- [ ] DATABASE_URL environment variable configured
- [ ] SSL mode set appropriately (`require` for production)
- [ ] Run migrations in order:
  ```bash
  npm run db:schema           # 001_schema.sql
  npm run db:seed-services    # 002_seed_services.sql
  npm run db:seed-pricing     # 003_seed_national_pricing.sql
  npm run db:seed-locations   # 004_seed_locations.sql
  psql "$DATABASE_URL" -f db/005_add_more_states.sql
  ```
- [ ] Verify tables created: `services`, `locations`, `national_pricing`, `macro_factors`, `location_pricing`
- [ ] Verify function exists: `recompute_location_pricing()`

### 2. API Keys Obtained
- [ ] BEA API Key: https://apps.bea.gov/api/signup/
- [ ] Admin API key generated (strong random string)
- [ ] BEA SARPP LineCode cached (recommended): Set to `1` for "All items RPP"

### 3. Environment Variables Set
```bash
# Required
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
BEA_API_KEY=your-bea-api-key-here
ADMIN_API_KEY=your-strong-admin-key-here

# Recommended (for stable production)
CPI_BASELINE_YEAR=2024
CPI_BASELINE_PERIOD=M01
BEA_SARPP_LINECODE=1
CPI_SERIES_ID=CUUR0000SA0

# Optional
NODE_ENV=production          # Disables Swagger UI
ENABLE_SWAGGER=false         # Keep Swagger disabled in prod
ENABLE_CORS=false            # Only if browser calls API directly
PORT=8080
```

### 4. Initial Data Refresh
- [ ] Run initial refresh to populate `macro_factors` and `location_pricing`:
  ```bash
  curl -X POST https://your-api.azurewebsites.net/admin/refresh \
    -H "x-admin-key: your-admin-key"
  ```
- [ ] Verify response includes stats:
  - CPI data loaded
  - RPP data loaded
  - States updated (should be 15)
  - Estimates computed (should be 225 = 15 services × 15 states)

## ✅ Azure App Service Configuration

### 1. App Service Plan
- [ ] Plan created with appropriate tier (B1 minimum for Always On)
- [ ] Linux runtime selected
- [ ] Node.js 18-lts or higher

### 2. Application Settings
- [ ] All environment variables configured in Azure Portal or CLI
- [ ] **Always On** enabled (required for WebJobs reliability)
- [ ] Health check path set to `/health`

### 3. WebJob Deployment

**IMPORTANT**: Having files in `webjobs/refresh/` does NOT automatically deploy the WebJob. You must explicitly deploy it.

#### Option A: Azure Portal (Easiest)
1. Navigate to your App Service → WebJobs
2. Click "+ Add"
3. Name: `refresh`
4. File Upload: Zip `webjobs/refresh/` (run.sh + settings.job)
5. Type: **Triggered**
6. Triggers: **Scheduled**
7. CRON Expression: `0 15 3 1 * *`
8. Click OK

#### Option B: Azure CLI
```bash
cd webjobs/refresh
zip -j refresh.zip run.sh settings.job

az webapp deployment source config-zip \
  --resource-group temp-services-rg \
  --name temp-services-api \
  --src refresh.zip
```

#### Option C: GitHub Actions (Recommended for CI/CD)
Add to `.github/workflows/deploy.yml`:
```yaml
- name: Deploy WebJob
  run: |
    cd webjobs/refresh
    zip -j refresh.zip run.sh settings.job
    az webapp deployment source config-zip \
      --resource-group ${{ secrets.AZURE_RG }} \
      --name ${{ secrets.AZURE_APP_NAME }} \
      --src refresh.zip
```

#### Verify WebJob
- [ ] WebJob appears in Azure Portal → WebJobs list
- [ ] Type shows "Triggered (Scheduled)"
- [ ] `is_singleton: true` in settings.job confirmed
- [ ] Schedule: `0 15 3 1 * *` (1st of month, 03:15 UTC)
- [ ] Test run: Click "Run" in portal, check logs for success

## ✅ Post-Deployment Testing

### 1. Health Check
```bash
curl https://your-api.azurewebsites.net/health
# Expected: {"ok": true}
```

### 2. Swagger Documentation
- [ ] Visit https://your-api.azurewebsites.net/docs
- [ ] All endpoints visible
- [ ] Interactive API testing works

### 3. Public Endpoints
```bash
# Test services list
curl https://your-api.azurewebsites.net/api/services

# Test locations list
curl https://your-api.azurewebsites.net/api/locations

# Test estimate (use correct service keys!)
curl "https://your-api.azurewebsites.net/api/estimate?service=junk-removal&location=ca"
curl "https://your-api.azurewebsites.net/api/estimate?service=house-cleaning&location=ny"
curl "https://your-api.azurewebsites.net/api/estimate?service=plumber&location=tx"
```

### 4. Admin Endpoint (Protected)
```bash
# Test without key (should return 401)
curl -X POST https://your-api.azurewebsites.net/admin/refresh

# Test with key (should succeed)
curl -X POST https://your-api.azurewebsites.net/admin/refresh \
  -H "x-admin-key: your-admin-key"
```

### 5. Input Validation
```bash
# Test invalid service (should return 404)
curl "https://your-api.azurewebsites.net/api/estimate?service=invalid-service&location=ca"

# Test invalid location (should return 404)
curl "https://your-api.azurewebsites.net/api/estimate?service=junk-removal&location=zz"

# Test missing params (should return 400)
curl "https://your-api.azurewebsites.net/api/estimate?service=junk-removal"
```

## ✅ UI Integration Verification

**CRITICAL**: Service keys in UI must match API exactly.

### Check API Services
```bash
curl https://your-api.azurewebsites.net/api/services | jq '.[].key'
```

Expected: `junk-removal`, `house-cleaning`, `lawn-mowing`, etc.

### Verify UI Content
Your UI's `content/services.ts` (or equivalent) must use these exact keys:

```typescript
export const services = [
  { key: 'junk-removal', ... },      // ✅ Matches API
  { key: 'house-cleaning', ... },    // ✅ Matches API
  { key: 'lawn-mowing', ... },       // ✅ Matches API
  // NOT: 'junk-removal-cost' ❌
  // NOT: 'house_cleaning' ❌
];
```

See [INTEGRATION.md](INTEGRATION.md) for full integration checklist.

## ✅ Monitoring Setup

### 1. Application Insights (Recommended)
- [ ] Application Insights resource created
- [ ] Instrumentation key added to App Service settings
- [ ] Custom alerts configured:
  - Admin refresh failures
  - High error rates
  - Slow response times

### 2. Log Monitoring
- [ ] Azure Monitor Logs enabled
- [ ] Log retention configured
- [ ] WebJob execution logs accessible

### 3. Health Monitoring
- [ ] Azure health check configured (`/health`)
- [ ] Alert on health check failures
- [ ] Uptime monitoring enabled

## ✅ Security Checklist

- [ ] ADMIN_API_KEY is strong (min 32 characters, random)
- [ ] DATABASE_URL uses SSL (`sslmode=require`)
- [ ] BEA_API_KEY kept secret (not committed to git)
- [ ] App Service configured with HTTPS only
- [ ] CORS configured if needed for frontend
- [ ] Rate limiting considered for public endpoints

## ✅ Backup & Recovery

- [ ] Database automated backups enabled
- [ ] Point-in-time recovery configured
- [ ] Disaster recovery plan documented
- [ ] Connection string backed up securely

## 📅 Monthly Maintenance

### Data Refresh Verification
- [ ] Check WebJob runs successfully on 1st of each month
- [ ] Verify CPI data updates (released ~13th of previous month)
- [ ] Verify RPP data updates (annually in May/June)
- [ ] Monitor admin refresh stats for anomalies

### BLS CPI Release Schedule
New CPI data typically released mid-month for previous month:
- January data → Released ~Feb 13
- February data → Released ~Mar 13
- etc.

**Note**: WebJob runs on 1st of month, so it captures previous month's data after it's released.

### BEA RPP Release Schedule
RPP data updated annually, typically May/June. Check:
- https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area

## 🔧 Troubleshooting

### WebJob Not Running
1. Verify Always On is enabled
2. Check WebJob logs in Azure Portal
3. Verify `is_singleton: true` in settings.job
4. Test manual refresh via API

### Database Connection Issues
1. Check DATABASE_URL format
2. Verify SSL mode matches database requirements
3. Check firewall rules allow Azure App Service
4. Test connection from Azure Console

### Refresh Failures
1. Check BEA_API_KEY is valid
2. Verify internet connectivity from App Service
3. Check BLS/BEA API status
4. Review transaction rollback logs
5. Verify database schema is up-to-date

### Missing Estimates
1. Run manual refresh: `POST /admin/refresh`
2. Verify `macro_factors` has CPI baseline
3. Verify `locations` have RPP indices
4. Check `location_pricing` table for computed values
5. Review `recompute_location_pricing()` function logs

## 📝 Rollback Plan

If deployment fails:

1. **Database**: Restore from point-in-time backup
   ```bash
   # Azure Database for PostgreSQL
   az postgres server restore ...
   ```

2. **Application**: Revert to previous deployment slot
   ```bash
   az webapp deployment slot swap --slot staging ...
   ```

3. **WebJob**: Remove and redeploy previous version

4. **Verify**: Run full post-deployment testing suite

## 🎯 Success Criteria

Deployment is successful when:
- ✅ All health checks pass
- ✅ Swagger UI accessible at `/docs`
- ✅ All 4 public endpoints return valid data
- ✅ Admin refresh endpoint protected and functional
- ✅ 404/400 validation working correctly
- ✅ WebJob scheduled and `is_singleton` confirmed
- ✅ Database contains 225 location_pricing records
- ✅ Graceful shutdown tested (no hanging connections)
- ✅ Transaction rollback tested (simulate BEA failure)

---

**Last Updated**: December 2024  
**Production Fixes Applied**: All 8 critical issues resolved
