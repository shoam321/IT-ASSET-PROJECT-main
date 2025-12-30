# Grafana-Frontend Connection Architecture & Troubleshooting Guide

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW DIAGRAM                              │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  PostgreSQL DB   │  (railway)
│  Tables:         │
│  - assets        │
│  - users         │
│  - licenses      │
│  - consumables   │
└────────┬─────────┘
         │
         │ TCP Connection (Port 31886)
         │ User: grafana_reader
         │ BYPASSRLS enabled
         │
         ▼
┌──────────────────────────────────────────────────────┐
│        GRAFANA SERVER (Production)                    │
│  https://grafana-production-f114.up.railway.app     │
│                                                      │
│  Dashboard: "IT Asset Dashboard"                     │
│  UID: adgfqcl                                        │
│  Slug: it-asset-dashboard                           │
│                                                      │
│  10 Panels:                                          │
│  1. Total Assets (Stat)                             │
│  2. Total Users (Stat)                              │
│  3. Total Licenses (Stat)                           │
│  4. Low Stock Alert (Stat)                          │
│  5. Assets by Category (Pie)                        │
│  6. Assets by Status (Bar)                          │
│  7. Low Stock Items (Table)                         │
│  8. Recent Assets (Table)                           │
│  9. License Expirations (Table)                     │
│  10. Asset Value Trend (Line)                       │
└────┬─────────────────────────────────────────────────┘
     │
     │ d-solo Iframe Embedding
     │ HTTP/HTTPS
     │ CORS Enabled
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  REACT FRONTEND                                      │
│  itam-saas/Client                                   │
│                                                      │
│  Component: Dashboard.jsx                           │
│  Location: src/components/Dashboard.jsx             │
│                                                      │
│  Environment: REACT_APP_GRAFANA_URL                │
│  Value: https://grafana-production-f114.up.railway.app
│                                                      │
│  Renders 10 iframes:                                │
│  <iframe src="{GRAFANA_URL}/d-solo/adgfqcl/        │
│    it-asset-dashboard?orgId=1&from=...&panelId=X"  │
│  />                                                 │
└──────────────────────────────────────────────────────┘
```

---

## Connection Points & Dependencies

### 1. **Database Layer** → **Grafana**

#### Connection Details
```
Protocol:        PostgreSQL TCP
Host:            caboose.proxy.rlwy.net
Port:            31886
Database:        railway
User:            grafana_reader
Password:        GrafanaR3adOnly!2025
TLS/SSL Mode:    require
Version:         12+
```

#### Verify Connection (in PostgreSQL)
```sql
-- Check if grafana_reader exists and has correct permissions
SELECT usename, usebypassrls FROM pg_user WHERE usename = 'grafana_reader';

-- Should return:
-- usename      | usebypassrls
-- grafana_reader | t

-- Check table permissions
SELECT grantee, privilege_type 
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
AND grantee = 'grafana_reader'
LIMIT 5;
```

#### Verify Data Exists
```sql
-- Each panel queries a different table
SELECT COUNT(*) FROM assets;           -- Should be > 0
SELECT COUNT(*) FROM users;            -- Should be > 0
SELECT COUNT(*) FROM licenses;         -- Should be > 0
SELECT COUNT(*) FROM consumables;      -- Should be > 0
```

#### Common Database Issues
| Issue | Cause | Solution |
|-------|-------|----------|
| "Connection refused" | PostgreSQL not running or port wrong | Verify Railway PostgreSQL is active |
| "FATAL: role does not exist" | grafana_reader user not created | Run user creation SQL in GRAFANA_SETUP.md |
| "Permission denied" | RLS policies blocking grafana_reader | Grant BYPASSRLS with: `ALTER ROLE grafana_reader BYPASSRLS;` |
| "SSL error" | TLS/SSL not configured correctly | Set "TLS/SSL Mode: require" in Grafana |
| "No data in panels" | Tables empty | Run seed-demo-data.js to populate test data |

---

### 2. **Grafana** → **Embedded Panels**

#### Grafana Configuration in UI
1. Login: https://grafana-production-f114.up.railway.app
2. Go to: **Dashboards** → Search for "IT Asset Dashboard"
3. Dashboard Details:
   - **UID:** `adgfqcl` (unique identifier in URL)
   - **Slug:** `it-asset-dashboard` (human-readable URL part)
   - **ID:** (auto-assigned by Grafana, changes per instance)

#### Panel URL Structure
```
{GRAFANA_URL}/d-solo/{DASHBOARD_UID}/{DASHBOARD_SLUG}?orgId=1&from={FROM}&to={TO}&timezone=browser&panelId={PANEL_ID}&theme=light

Example:
https://grafana-production-f114.up.railway.app/d-solo/adgfqcl/it-asset-dashboard?orgId=1&from=now-30d&to=now&timezone=browser&panelId=1&theme=light
```

#### URL Parameters Explained
| Parameter | Value | Purpose |
|-----------|-------|---------|
| `d-solo` | literal | Tells Grafana to render in solo mode (no Grafana UI) |
| `adgfqcl` | Dashboard UID | Unique identifier for the dashboard |
| `it-asset-dashboard` | Dashboard slug | Human-readable dashboard name |
| `orgId=1` | 1 | Grafana organization ID (default org) |
| `from=now-30d` | Time offset | Start of time range (30 days ago) |
| `to=now` | Time offset | End of time range (current time) |
| `timezone=browser` | Timezone | Use browser's timezone for display |
| `panelId=1` | Panel number | Which panel to display (1-10) |
| `theme=light` | Theme | Visual theme (light/dark) |

#### Verify Grafana Setup
```bash
# Test if Grafana is accessible
curl -I https://grafana-production-f114.up.railway.app/

# Test dashboard exists (should return 200)
curl -I "https://grafana-production-f114.up.railway.app/d/adgfqcl/it-asset-dashboard"

# Test solo panel endpoint
curl -I "https://grafana-production-f114.up.railway.app/d-solo/adgfqcl/it-asset-dashboard?orgId=1&panelId=1"
```

#### Grafana Settings to Check
```
Configuration → Settings → Security → allow_embedding = true
```

#### Common Grafana Issues
| Issue | Cause | Solution |
|-------|-------|----------|
| Panels show "No data" | Dashboard queries failing | Go to dashboard, edit each panel, check query |
| Dashboard not found (404) | Wrong UID or slug | Verify UID is `adgfqcl`, slug is `it-asset-dashboard` |
| Authentication required | Public access disabled | Dashboard Settings → General → tick "Public Dashboard" |
| CORS errors | Embedding not allowed | Enable `allow_embedding = true` in Grafana config |
| Wrong data displayed | Data source not configured | Verify PostgreSQL data source is set in Grafana |
| Panels loading but empty | RLS blocking data | Ensure grafana_reader has BYPASSRLS |

---

### 3. **React Frontend** → **Grafana iframes**

#### Configuration Files

##### `.env` (itam-saas/Client/.env)
```bash
REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app
```

##### Dashboard Component (itam-saas/Client/src/components/Dashboard.jsx)
```javascript
// Line 10-14: Reads environment variable
const GRAFANA_URL = process.env.REACT_APP_GRAFANA_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://grafana-production-f114.up.railway.app');

// Line 27-36: Panel definitions
const panels = [
  { id: 1, title: 'Total Assets', height: 200, type: 'stat' },
  { id: 2, title: 'Total Users', height: 200, type: 'stat' },
  // ... etc
];

// Line 169: Constructs iframe URL
const panelUrl = `${GRAFANA_URL}/d-solo/adgfqcl/it-asset-dashboard?orgId=1&${timeRange}&timezone=browser&panelId=${panelId}&theme=light`;
```

#### How React Renders Grafana Panels
```jsx
// 1. Component reads GRAFANA_URL from environment
// 2. For each panel, constructs URL with specific panelId
// 3. Renders iframe with that URL
// 4. iframes are sandboxed with limited permissions

<iframe
  src={panelUrl}
  width="100%"
  height={panelHeight}
  frameBorder="0"
  title={title}
  className="w-full h-full"
  sandbox="allow-scripts allow-same-origin allow-popups"
  loading="lazy"
/>
```

#### Component Flow
```
App.jsx
  ↓
currentScreen === 'dashboard'
  ↓
<Dashboard />
  ↓
Read REACT_APP_GRAFANA_URL from .env
  ↓
Loop through 10 panels array
  ↓
For each panel, render <GrafanaPanel />
  ↓
GrafanaPanel constructs iframe URL
  ↓
iframe loads from Grafana
  ↓
Grafana fetches data from PostgreSQL
  ↓
Panel renders in iframe
```

#### Frontend HTTP Requests
When you visit the Dashboard:
```
1. Browser requests: https://YOUR_APP/dashboard
2. React loads Dashboard.jsx component
3. Dashboard reads .env: REACT_APP_GRAFANA_URL
4. For each of 10 panels, creates iframe src URL
5. Browser makes 10 parallel iframe requests:
   - https://grafana-production-f114.up.railway.app/d-solo/adgfqcl/it-asset-dashboard?...&panelId=1
   - https://grafana-production-f114.up.railway.app/d-solo/adgfqcl/it-asset-dashboard?...&panelId=2
   - ... (and so on for panels 3-10)
6. Each iframe request triggers Grafana to query PostgreSQL
7. Results are rendered in each iframe
```

#### Verify Frontend Setup
```bash
# Check .env file exists and has correct value
cat itam-saas/Client/.env
# Output should show:
# REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app

# Build React app (will fail if .env variables missing)
npm run build

# Look for REACT_APP variables in build output
npm run build 2>&1 | grep REACT_APP
```

#### Common Frontend Issues
| Issue | Cause | Solution |
|-------|-------|----------|
| Panels show "Loading panel..." | Iframe not loading | Check browser console (F12) for errors |
| CORS errors in console | Grafana not allowing iframe | Enable `allow_embedding = true` in Grafana |
| Panels show "No data" | Dashboard works but queries fail | Go to Grafana, edit panel, run query |
| Wrong Grafana URL | Environment variable misconfigured | Verify .env: `REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app` |
| Variable undefined in code | .env not loaded during build | Restart dev server or rebuild: `npm run build` |
| 404 on dashboard load | Wrong Grafana URL or offline | Test URL directly in browser |

---

## Complete Debugging Flowchart

```
❌ Dashboard shows no data?

├─ Check 1: Is Grafana accessible?
│  └─ Open https://grafana-production-f114.up.railway.app in browser
│     ├─ YES → Continue to Check 2
│     └─ NO → Grafana server is down
│            Action: Restart Grafana on Railway
│
├─ Check 2: Does dashboard exist?
│  └─ Search for "IT Asset Dashboard" in Grafana
│     ├─ YES → Continue to Check 3
│     └─ NO → Dashboard not found
│            Action: Re-import grafana-dashboard-import.json
│
├─ Check 3: Can you see the panels in Grafana UI?
│  └─ Go to: https://grafana-production-f114.up.railway.app/d/adgfqcl/it-asset-dashboard
│     ├─ YES (panels show data) → Continue to Check 4
│     ├─ YES (panels show no data) → Continue to Check 5
│     └─ NO (404) → Check dashboard UID is 'adgfqcl'
│
├─ Check 4: Do panels load in React app?
│  └─ Visit React app → click Dashboard
│     ├─ YES (data shows) → ✅ System working!
│     ├─ YES (no data) → Continue to Check 5
│     └─ NO (loading spinner) → Continue to Check 6
│
├─ Check 5: Is PostgreSQL working?
│  └─ Connect to railway PostgreSQL, run:
│     SELECT COUNT(*) FROM assets;
│     ├─ Returns > 0 → Continue to Check 7
│     └─ Returns 0 → No demo data
│                    Action: Run seed-demo-data.js
│
├─ Check 6: Check browser console for errors (F12)
│  └─ Open Developer Tools → Console tab
│     ├─ CORS errors → Grafana allow_embedding disabled
│     ├─ 404 errors → Wrong Grafana URL or panelId
│     ├─ timeout → Grafana server unreachable
│     └─ No errors → Continue to Check 7
│
├─ Check 7: Is .env file correct?
│  └─ Verify itam-saas/Client/.env contains:
│     REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app
│     ├─ YES → Continue to Check 8
│     └─ NO → Update .env and restart dev server
│
├─ Check 8: Are panel IDs correct?
│  └─ Verify panels have correct IDs (1-10) in Grafana
│     ├─ YES → Continue to Check 9
│     └─ NO → Re-create panels with correct IDs
│
├─ Check 9: Is Grafana data source working?
│  └─ In Grafana: Configuration → Data Sources → PostgreSQL
│     ├─ Click "Save & Test"
│     ├─ Shows "Database Connection OK" → Continue to Check 10
│     └─ Shows error → Check PostgreSQL credentials
│
└─ Check 10: Are panel queries correct?
   └─ In Grafana: Edit each panel → Run query
      ├─ Shows data → Query is good
      ├─ "No data" → Query returns empty result
      │            Action: Check if tables have data
      └─ Error → Query syntax error
                 Action: Review query in panel config
```

---

## Network Connectivity Verification

### Test Each Layer

#### Layer 1: React App to Grafana
```bash
# From your React app server, test connectivity
curl -v https://grafana-production-f114.up.railway.app/
# Should return 200 OK

# Test solo panel endpoint specifically
curl -v "https://grafana-production-f114.up.railway.app/d-solo/adgfqcl/it-asset-dashboard?orgId=1&panelId=1"
# Should return HTML content (no 404)
```

#### Layer 2: Grafana to PostgreSQL
**In Grafana UI:**
1. Configuration → Data Sources
2. Click "PostgreSQL"
3. Click "Save & Test"
4. Look for: "Database Connection OK" (green)

**Or test from command line:**
```bash
# Install psql if not present
brew install postgresql  # Mac
apt-get install postgresql-client  # Linux

# Connect to Railway PostgreSQL
psql -h caboose.proxy.rlwy.net \
     -p 31886 \
     -U grafana_reader \
     -d railway \
     -c "SELECT COUNT(*) FROM assets;"
# Enter password: GrafanaR3adOnly!2025
```

#### Layer 3: Browser to Grafana
**In browser console (F12):**
```javascript
// Test if Grafana URL is reachable
fetch('https://grafana-production-f114.up.railway.app/')
  .then(r => r.text())
  .then(t => console.log('Grafana OK:', t.length > 0))
  .catch(e => console.error('Grafana Error:', e))
```

---

## Configuration Checklist

### ✅ Pre-Flight Checks

#### PostgreSQL Database
- [ ] Database name: `railway`
- [ ] Table exists: `assets`
- [ ] Table exists: `users`
- [ ] Table exists: `licenses`
- [ ] Table exists: `consumables`
- [ ] User `grafana_reader` exists
- [ ] User has SELECT permission on all tables
- [ ] User has `BYPASSRLS` role attribute
- [ ] Connection string: `caboose.proxy.rlwy.net:31886`
- [ ] TLS/SSL enabled

#### Grafana Instance
- [ ] Running at: `https://grafana-production-f114.up.railway.app`
- [ ] Admin user login works
- [ ] PostgreSQL data source added
- [ ] Data source "Save & Test" shows OK
- [ ] Dashboard UID: `adgfqcl`
- [ ] Dashboard slug: `it-asset-dashboard`
- [ ] 10 panels created with correct IDs (1-10)
- [ ] `allow_embedding = true` in config
- [ ] Dashboard set to "Public Dashboard" (if needed)

#### React App
- [ ] `.env` file exists at `itam-saas/Client/.env`
- [ ] `.env` contains: `REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app`
- [ ] Dashboard component imported in App.jsx
- [ ] Dashboard component renders at correct screen
- [ ] Environment variables loaded in build

---

## File Structure & Locations

```
IT-ASSET-PROJECT/
├── grafana-dashboard-import.json          # Dashboard configuration (import to Grafana)
├── GRAFANA_SETUP.md                       # Database & Grafana configuration guide
├── GRAFANA_EMBEDDING.md                   # How to embed in React
├── GRAFANA_INTEGRATION_COMPLETE.md        # Integration status
├── GRAFANA_FRONTEND_CONNECTION_GUIDE.md   # THIS FILE
│
├── itam-saas/
│   └── Client/
│       ├── .env                           # ⭐ CRITICAL: Contains REACT_APP_GRAFANA_URL
│       ├── src/
│       │   ├── App.jsx                    # Main app, imports Dashboard
│       │   └── components/
│       │       └── Dashboard.jsx           # ⭐ Renders all 10 Grafana panels
│       └── package.json
│
└── Railway/
    └── PostgreSQL                         # ⭐ CRITICAL: Source of all data
```

---

## Key Variables & Their Values

### Environment Variables
```
REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app
```

### Grafana Dashboard
```
UID:      adgfqcl
Slug:     it-asset-dashboard
Org ID:   1
Theme:    light
Mode:     d-solo (solo panel mode)
```

### PostgreSQL Connection
```
Host:     caboose.proxy.rlwy.net
Port:     31886
User:     grafana_reader
Password: GrafanaR3adOnly!2025
Database: railway
SSL:      require
```

### Panel IDs (in order)
```
1  = Total Assets
2  = Total Users
3  = Total Licenses
4  = Low Stock Alert
5  = Assets by Category
6  = Assets by Status
7  = Low Stock Items
8  = Recent Assets
9  = License Expirations
10 = Asset Value Trend
```

---

## Real-World Troubleshooting Examples

### Scenario 1: "All panels show Loading..."
```
Diagnosis Steps:
1. Open browser DevTools (F12) → Console tab
2. Look for errors like:
   - "CORS error"
   - "Failed to load"
   - "403 Forbidden"
3. Check actual error message

Common Causes & Fixes:
- CORS error → Grafana allow_embedding disabled
  Fix: Grafana config: allow_embedding = true
  
- 404 error → Wrong dashboard UID
  Fix: Verify UID in Dashboard.jsx is 'adgfqcl'
  
- 403 error → Grafana authentication issue
  Fix: Dashboard must be set to "Public Dashboard"
  
- Timeout → Grafana unreachable
  Fix: Test https://grafana-production-f114.up.railway.app in browser
```

### Scenario 2: "Panels load but show 'No Data'"
```
Diagnosis Steps:
1. Go to Grafana directly: https://grafana-production-f114.up.railway.app
2. Open "IT Asset Dashboard"
3. Do panels show data here?

If YES in Grafana but NO in React:
  → Problem: React app not connected properly
  → Solution: Check .env REACT_APP_GRAFANA_URL value
  
If NO in both Grafana and React:
  → Problem: Database has no data or queries failing
  → Solution: 
     a) Check if tables have data: SELECT COUNT(*) FROM assets;
     b) If 0 rows: Run seed-demo-data.js
     c) If tables exist but queries fail: Check RLS permissions
     d) In Grafana, edit panel and run query manually
```

### Scenario 3: "Environment variables not loading"
```
Diagnosis Steps:
1. Check .env file exists:
   ls -la itam-saas/Client/.env
   
2. Verify contents:
   cat itam-saas/Client/.env
   
3. Check if variable is prefixed correctly:
   Must start with REACT_APP_ to be injected into React
   
If .env is correct but still not working:
  → Solution: Restart dev server (kill and run npm start)
  → Build step includes .env at build time
  → Changes to .env require rebuild
```

### Scenario 4: "PostgreSQL connection refused"
```
Diagnosis Steps:
1. Test from command line:
   psql -h caboose.proxy.rlwy.net -p 31886 -U grafana_reader -d railway
   
2. Check credentials in Railway dashboard
3. Verify Railway PostgreSQL is running (green status)

If connection works from CLI but fails in Grafana:
  → Check Grafana data source settings exactly match:
     Host: caboose.proxy.rlwy.net
     Port: 31886
     User: grafana_reader
     Password: GrafanaR3adOnly!2025
     Database: railway
     SSL/TLS: require
```

---

## Debugging Commands

### Test Grafana Connectivity
```bash
# Basic connectivity
ping grafana-production-f114.up.railway.app
curl -I https://grafana-production-f114.up.railway.app

# Full dashboard URL
curl -v "https://grafana-production-f114.up.railway.app/d/adgfqcl/it-asset-dashboard"

# Specific panel (solo mode)
curl -v "https://grafana-production-f114.up.railway.app/d-solo/adgfqcl/it-asset-dashboard?orgId=1&panelId=1"
```

### Test PostgreSQL Connectivity
```bash
# Direct connection
psql -h caboose.proxy.rlwy.net -p 31886 -U grafana_reader -d railway

# Quick data check
psql -h caboose.proxy.rlwy.net -p 31886 -U grafana_reader -d railway -c "SELECT COUNT(*) as total_assets FROM assets;"
```

### Test React App Environment
```bash
# Check if .env is being used
npm run build 2>&1 | grep -i "grafana"

# View environment variables at runtime (in browser console)
console.log(process.env.REACT_APP_GRAFANA_URL)
```

### Browser DevTools Debugging
```javascript
// In browser console (F12), test Grafana access:
fetch('https://grafana-production-f114.up.railway.app/api/health')
  .then(r => r.json())
  .then(d => console.log('Grafana Health:', d))
  .catch(e => console.error('Grafana Error:', e))

// Test specific panel URL:
fetch('https://grafana-production-f114.up.railway.app/d-solo/adgfqcl/it-asset-dashboard?orgId=1&panelId=1')
  .then(r => r.text())
  .then(t => console.log('Panel HTML size:', t.length))
  .catch(e => console.error('Panel Error:', e))
```

---

## Dependency Map

```
React App depends on:
├── .env file
│   └── REACT_APP_GRAFANA_URL
│
├── Dashboard.jsx component
│   ├── Reads REACT_APP_GRAFANA_URL
│   ├── Constructs iframe URLs with:
│   │   ├── Dashboard UID: adgfqcl
│   │   ├── Dashboard slug: it-asset-dashboard
│   │   ├── Panel IDs: 1-10
│   │   └── Org ID: 1
│   └── Renders 10 iframes
│
└── Grafana Server depends on:
    ├── Database connectivity
    │   ├── Host: caboose.proxy.rlwy.net
    │   ├── Port: 31886
    │   ├── User: grafana_reader
    │   └── Database: railway
    │
    ├── Dashboard configuration
    │   ├── UID: adgfqcl
    │   └── 10 panels with correct queries
    │
    └── PostgreSQL depends on:
        ├── Tables: assets, users, licenses, consumables
        ├── User permissions: SELECT, BYPASSRLS
        └── Data: Must have test data
```

---

## Emergency Recovery Steps

If everything breaks:

### 1. Verify PostgreSQL is running
```bash
# Check Railway dashboard for PostgreSQL status
# Should show green "Active" status
```

### 2. Reimport Grafana Dashboard
```
1. Go to Grafana: https://grafana-production-f114.up.railway.app
2. Dashboards → Import
3. Upload: grafana-dashboard-import.json
4. Select PostgreSQL data source
5. Click Import
```

### 3. Verify Dashboard UID
```
After import, dashboard should be at:
https://grafana-production-f114.up.railway.app/d/adgfqcl/it-asset-dashboard

If UID is different:
- Edit Dashboard.jsx
- Update UID in line: const panelUrl = ...
- Change 'adgfqcl' to the new UID
```

### 4. Restart React Dev Server
```bash
# Kill current server
# Clear node_modules cache
rm -rf itam-saas/Client/node_modules/.cache

# Reinstall and restart
cd itam-saas/Client
npm install
npm start
```

### 5. Clear Browser Cache
```
1. Open DevTools (F12)
2. Right-click refresh button → Hard Refresh
   OR
3. Network tab → Disable cache (while DevTools open)
```

---

## Monitoring & Health Checks

### Daily Health Check Script
```bash
#!/bin/bash

echo "=== Grafana Health ==="
curl -s -I https://grafana-production-f114.up.railway.app/ | grep HTTP

echo "=== PostgreSQL Connection ==="
psql -h caboose.proxy.rlwy.net -p 31886 \
     -U grafana_reader -d railway \
     -c "SELECT 'PostgreSQL OK' as status;" 2>&1

echo "=== Asset Count ==="
psql -h caboose.proxy.rlwy.net -p 31886 \
     -U grafana_reader -d railway \
     -c "SELECT COUNT(*) as total_assets FROM assets;"

echo "=== Dashboard Panel Check ==="
curl -s -I "https://grafana-production-f114.up.railway.app/d-solo/adgfqcl/it-asset-dashboard?orgId=1&panelId=1" | grep HTTP
```

---

## Documentation Updates Log

When you fix something, add it here:

| Date | Issue | Root Cause | Fix | Files Changed |
|------|-------|-----------|-----|---------------|
| 2025-12-30 | Panels not rendering | Dashboard UID mismatch | Updated to `adgfqcl` | Dashboard.jsx |
| | | | | |

---

## Quick Reference Card

### When Panels Show "No Data"
1. ✅ Check PostgreSQL has data: `SELECT COUNT(*) FROM assets;`
2. ✅ Check Grafana can query: Run query in Grafana panel
3. ✅ Check RLS: `SELECT usebypassrls FROM pg_user WHERE usename='grafana_reader';` (should be `true`)
4. ✅ Check connection: Grafana → Data Sources → PostgreSQL → Save & Test

### When Panels Won't Load
1. ✅ Check browser console (F12) for errors
2. ✅ Check Grafana URL accessible: Visit in new tab
3. ✅ Check CORS: `allow_embedding = true` in Grafana config
4. ✅ Check .env: `REACT_APP_GRAFANA_URL` set correctly

### When React App Can't Find Grafana
1. ✅ Check .env file in `itam-saas/Client/.env`
2. ✅ Verify value: `REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app`
3. ✅ Restart dev server: Kill npm start, run again
4. ✅ Clear browser cache: F12 → Hard Refresh

---

## Further Reading

- [GRAFANA_SETUP.md](./GRAFANA_SETUP.md) - Database and Grafana configuration
- [GRAFANA_EMBEDDING.md](./GRAFANA_EMBEDDING.md) - React embedding details
- [GRAFANA_INTEGRATION_COMPLETE.md](./GRAFANA_INTEGRATION_COMPLETE.md) - Current integration status
- [Grafana Official Docs](https://grafana.com/docs/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-30  
**Status:** Complete
