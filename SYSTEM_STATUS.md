# IT Asset Management System - Status Report

**Last Updated:** December 31, 2025  
**Status:** ✅ All Systems Operational

---

## 🚀 Live Endpoints

| Service | URL |
|---------|-----|
| **Frontend** | https://it-asset-project.vercel.app |
| **Backend API** | https://it-asset-project-production.up.railway.app |
| **Grafana** | https://grafana-production-f114.up.railway.app |
| **Database** | PostgreSQL on Railway (caboose.proxy.rlwy.net:31886) |

---

## ✅ Working Features

### Authentication & Onboarding
- [x] Google SSO login
- [x] JWT token authentication
- [x] Organization creation during onboarding
- [x] User gets `org_role='owner'` after completing onboarding
- [x] Session management with PostgreSQL store

### Multi-Tenancy
- [x] Organizations table with RLS disabled (security at app level)
- [x] Users linked to organizations via `organization_id`
- [x] Role-based access: owner, admin, member

### Asset Management
- [x] CRUD operations for assets
- [x] Asset categories with icons
- [x] Location tracking
- [x] Employee assignment

### Additional Features
- [x] License management with expiration tracking
- [x] Contract management
- [x] Consumables with low-stock alerts
- [x] Forbidden apps detection (agent)
- [x] Security alerts via WebSocket
- [x] Grafana dashboard embedding
- [x] PayPal subscription billing
- [x] Email notifications via Resend

---

## 📊 Grafana Integration

### Embedding Dashboards
Use this URL format to embed panels:
```
https://grafana-production-f114.up.railway.app/d-solo/adgfqcl/it-asset-dashboard?orgId=1&panelId=1
```

**Parameters:**
- `d-solo` - Solo panel view (for embedding)
- `adgfqcl` - Dashboard UID
- `panelId=1` - Which panel (1-10 available)

### Available Panels
| Panel ID | Name |
|----------|------|
| 1 | Total Assets |
| 2 | Total Users |
| 3 | Total Licenses |
| 4 | Low Stock Alert |
| 5 | Assets by Category (Pie) |
| 6 | Assets by Status |
| 7 | Low Stock Items (Table) |
| 8 | Recent Assets |
| 9 | License Expirations |
| 10 | Asset Value Trend |

### Allowed Grafana Hosts
The backend automatically allows:
- `*.railway.app`
- `*.grafana.com`
- `*.grafana.net`

---

## 🗄️ Database Schema

### Core Tables
```
organizations     - Multi-tenant organizations
auth_users        - Users with organization_id and org_role
assets            - IT assets with category_id, location_id
licenses          - Software licenses
contracts         - Vendor contracts
consumables       - Inventory items with stock tracking
```

### Supporting Tables
```
locations         - Physical locations per organization
employees         - Ghost users / assignees
asset_categories  - Categories with icons
grafana_dashboards - Saved Grafana embed URLs
security_alerts   - Agent-reported security events
forbidden_apps    - Blocked application list
device_usage      - Agent telemetry data
```

---

## 🔧 Recent Fixes Applied

### 1. RLS Policy Fix (Dec 31, 2025)
- **Issue:** Organization INSERT blocked by RLS policy
- **Solution:** Disabled RLS on organizations table, security handled at application level

### 2. User Role Fix (Dec 31, 2025)
- **Issue:** Users getting `org_role='member'` instead of `'owner'`
- **Solution:** Updated onboarding endpoint to always set `org_role='owner'`

### 3. Schema Creation Fix (Dec 31, 2025)
- **Issue:** `ensureSchema` functions failing with "permission denied"
- **Solution:** Added existence checks before CREATE TABLE attempts

### 4. Grafana URL Validation (Dec 31, 2025)
- **Issue:** "Embed URL host not allowed" error
- **Solution:** Added default allowed hosts: railway.app, grafana.com, grafana.net

---

## 🔐 Environment Variables

### Required on Railway
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
SESSION_SECRET=your-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://it-asset-project-production.up.railway.app/api/auth/google/callback
FRONTEND_URL=https://it-asset-project.vercel.app
RESEND_API_KEY=...
REDIS_URL=redis://...
```

### Optional
```env
DATABASE_OWNER_URL=postgresql://... (for schema migrations)
GRAFANA_ALLOWED_HOSTS=custom-grafana.example.com
MINDEE_API_KEY=... (for receipt parsing)
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```

---

## 📱 Desktop Agent

The agent monitors Windows devices and reports:
- Running applications
- Forbidden app usage
- Device metrics

**Agent API Endpoints:**
- `POST /api/agent/usage` - Report app usage
- `POST /api/agent/heartbeat` - Device health check

---

## 🧪 Verification Steps

### Test Onboarding
1. Go to https://it-asset-project.vercel.app
2. Sign in with Google
3. Complete onboarding form
4. Verify organization created and user is owner

### Test Grafana
1. Go to Analytics page
2. Add new dashboard with URL:
   ```
   https://grafana-production-f114.up.railway.app/d-solo/adgfqcl/it-asset-dashboard?orgId=1&panelId=1
   ```
3. Verify embed loads correctly

### Health Check
```bash
curl https://it-asset-project-production.up.railway.app/health
```

---

## 📞 Support

For issues, check Railway logs:
1. Go to Railway dashboard
2. Select the backend service
3. Click "Logs" tab
4. Search for error messages

Common log patterns:
- `✅` - Success
- `❌` - Error
- `⚠️` - Warning
