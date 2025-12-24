# 🚨 CRITICAL: Service Key Integration

## Service Keys MUST Match UI

Your API service keys have been updated to match your UI. **Do not change these without updating both sides**.

### Current Service Keys (API ↔️ UI)

```
junk-removal      ← Must match UI exactly
house-cleaning    ← Must match UI exactly  
lawn-mowing       ← Must match UI exactly
snow-removal      ← Must match UI exactly
handyman          ← Must match UI exactly
plumber           ← Must match UI exactly
electrician       ← Must match UI exactly
hvac              ← Must match UI exactly
moving            ← Must match UI exactly
pest-control      ← Must match UI exactly
painting          ← Must match UI exactly
roofing           ← Must match UI exactly
carpentry         ← Must match UI exactly
landscaping       ← Must match UI exactly
pet-sitting       ← Must match UI exactly
```

## Verification Checklist

Before deploying, verify integration:

### 1. Check API Services
```bash
curl http://localhost:8080/api/services | jq '.[].key'
```

Expected output:
```json
"junk-removal"
"house-cleaning"
"lawn-mowing"
...
```

### 2. Test API Estimate
```bash
curl "http://localhost:8080/api/estimate?service=junk-removal&location=ca"
```

Should return pricing data (not 404).

### 3. Verify UI Content
Check your UI `content/services.ts` or equivalent:

```typescript
export const services = [
  { key: 'junk-removal', ... },      // ✅ Matches API
  { key: 'house-cleaning', ... },    // ✅ Matches API
  // ...
];
```

### 4. Cross-Reference
UI service key → Must exist in `/api/services`

## Common Integration Failures

### ❌ 404 Errors
```bash
curl "http://localhost:8080/api/estimate?service=plumber-hourly&location=ca"
# Returns: {"error":"Service 'plumber-hourly' not found"}
```

**Cause**: UI uses `plumber-hourly` but API has `plumber`  
**Fix**: Update UI to use `plumber` OR update API seeds

### ❌ Wrong Pricing Data
UI shows "Hourly" but API returns "per load"  
**Cause**: Service key mismatch  
**Fix**: Ensure keys match exactly

## Source of Truth

**API** is the source of truth for:
- Service keys
- Service names
- Units
- Pricing data

**UI** must fetch and display exactly what API returns.

## Deployment Verification

After deploying API to production:

```bash
# 1. Get all services
curl https://your-api.azurewebsites.net/api/services

# 2. Test each service from your UI
for service in junk-removal house-cleaning lawn-mowing; do
  curl "https://your-api.azurewebsites.net/api/estimate?service=$service&location=ca"
done
```

All should return pricing data (not 404).

## If You Need to Change Service Keys

1. **Update both simultaneously**:
   - API: `db/002_seed_services.sql` + `db/003_seed_national_pricing.sql`
   - UI: `content/services.ts` (or equivalent)

2. **Redeploy API database**:
   ```bash
   npm run db:seed-services
   npm run db:seed-pricing
   npm run refresh  # Recompute estimates
   ```

3. **Redeploy UI**

4. **Verify integration** (see checklist above)

---

**Last Updated**: December 20, 2024  
**Status**: Keys aligned with UI ✅
