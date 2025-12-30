# Railway Deployment Error Resolution Guide

## Quick Diagnosis: Why All Errors Occurred

Your deployment is failing due to a **cascading sequence of issues**:

```
1. Schema Mismatches → Database queries fail
   ↓
2. Missing Roles/Permissions → Auth fails
   ↓
3. RLS Policy Violations → Inserts blocked
   ↓
4. MemoryStore Sessions Lost → Users logged out
   ↓
5. Connection Resets → Server crashes repeatedly
```

---

## All Errors & Their Root Causes

### 1. **"MemoryStore is not designed for production"** ⚠️
**What**: Session data stored in RAM, lost on restart  
**Why**: `server.js` is trying `connect-pg-simple` but falling back to MemoryStore  
**Fix**: 
```bash
# In Railway, set environment variable:
USE_PG_SESSION=true
SESSION_SECRET=<generate with: openssl rand -hex 32>
```

---

### 2. **"column 'organization_id' does not exist"** ❌
**What**: Application code expects `auth_users.organization_id` but it doesn't exist  
**Why**: Database schema is incomplete - migration not applied  
**Fix**: Run `FIX-ALL-ERRORS.sql` to add all missing columns

---

### 3. **"password authentication failed for user 'itam_app'"** 🔐
**What**: Server can't connect to database  
**Why**: Either:
- Wrong password in connection string
- User doesn't exist
- Wrong database selected  

**Fix**:
```sql
-- Create the user if missing
CREATE USER itam_app WITH PASSWORD 'ITAssetApp@2025';

-- Or reset password
ALTER USER itam_app PASSWORD 'ITAssetApp@2025';
```

Then update `DATABASE_URL` in Railway environment.

---

### 4. **"role 'grafana_reader' does not exist"** 📊
**What**: Grafana datasource trying to use non-existent role  
**Why**: Role was never created in PostgreSQL  
**Fix**:
```sql
CREATE ROLE grafana_reader WITH LOGIN PASSWORD 'GrafanaR3adOnly!2025';
GRANT CONNECT ON DATABASE railway TO grafana_reader;
GRANT USAGE ON SCHEMA public TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
```

---

### 5. **"new row violates row-level security policy"** 🔒
**What**: Can't insert assets because RLS blocks it  
**Why**: RLS policies are too restrictive OR missing `user_id`  
**Fix**: See section "Fix RLS" below

---

### 6. **"column 'is_active' does not exist"** ❌
**What**: Dashboard query expects `users.is_active` column  
**Why**: Schema migration incomplete  
**Fix**:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
```

---

### 7. **"permission denied to create role"** 🚫
**What**: Can't create roles because user lacks permissions  
**Why**: Using wrong user account (not superuser)  
**Fix**: 
- Connect as `postgres` (superuser) 
- Or run as Railway default user with escalated privileges

---

## Step-by-Step Resolution

### Step 1: Apply Database Schema Fix
```bash
# On your local machine, connect to Railway PostgreSQL:
psql postgresql://postgres:PASSWORD@caboose.proxy.rlwy.net:31886/railway?sslmode=require < FIX-ALL-ERRORS.sql

# Or copy-paste FIX-ALL-ERRORS.sql into Railway's PostgreSQL web console
```

### Step 2: Update Railway Environment Variables
```
# In Railway Dashboard → Environment Variables:

USE_PG_SESSION=true
SESSION_SECRET=<openssl rand -hex 32>  # Generate new secure key
DB_USER=itam_app
DB_PASSWORD=ITAssetApp@2025
DATABASE_URL=postgresql://itam_app:ITAssetApp@2025@caboose.proxy.rlwy.net:31886/railway?sslmode=require
NODE_ENV=production
```

### Step 3: Restart Services
```bash
# In Railway Dashboard:
1. Stop backend service
2. Wait 30 seconds
3. Start backend service
4. Monitor logs for clean startup
```

### Step 4: Verify Fixes
```bash
# Check database connections work:
curl https://your-backend-url/api/health

# Check Grafana is accessible:
curl https://grafana-production-f114.up.railway.app/api/health

# Check frontend loads:
Open browser → https://your-frontend-url
```

---

## Fix RLS (Row-Level Security) Issues

If you still see "new row violates row-level security policy":

### Option A: Temporarily Disable RLS (Development Only ⚠️)
```sql
-- Connect as postgres user
ALTER TABLE assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE licenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Re-enable after schema changes
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
-- etc...
```

### Option B: Fix RLS Policies Properly
```sql
-- Drop conflicting policies
DROP POLICY IF EXISTS assets_insert_policy ON assets;

-- Create permissive policy
CREATE POLICY assets_insert_policy ON assets
  FOR INSERT
  WITH CHECK (true);

-- Verify policies exist
SELECT tablename, policyname FROM pg_policies 
WHERE tablename = 'assets';
```

---

## Verify All Fixes

Run these SQL queries to confirm everything is fixed:

```sql
-- ✓ Check auth_users has all required columns
\d auth_users

-- ✓ Check users table has is_active
\d users

-- ✓ Check assets table is complete
\d assets

-- ✓ Verify grafana_reader role exists
SELECT * FROM pg_roles WHERE rolname = 'grafana_reader';

-- ✓ Check RLS policies
SELECT tablename, policyname FROM pg_policies;

-- ✓ Test query that was failing
SELECT COUNT(*) as value FROM users;

-- ✓ Test asset insert
INSERT INTO assets (asset_tag, asset_type, manufacturer, status) 
VALUES ('TEST-001', 'Laptop', 'Dell', 'In Use');
```

---

## Verify in Application

After fixes, check in your IT Asset app:
1. **Dashboard loads** → No console errors
2. **Can create assets** → No RLS violations
3. **Can see users** → `is_active` column works
4. **Grafana graphs display** → Datasource connection works
5. **Sessions persist** → Logged in after page reload

---

## Environment Variable Checklist

Make sure these are set in Railway:

```
✓ DATABASE_URL (with correct password)
✓ USE_PG_SESSION=true
✓ SESSION_SECRET (32-char hex)
✓ JWT_SECRET (32-char hex)
✓ NODE_ENV=production
✓ REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app
✓ Port is not 5000 (conflicts with PostgreSQL default)
```

---

## If Still Broken

### Check Logs
```bash
# In Railway Dashboard → Logs tab
# Look for:
# - "Database Connection OK" ✓
# - "Session store initialized" ✓
# - No "ERROR" or "FATAL" messages
```

### Common Next Issues
1. **CORS errors** → Update frontend CORS settings
2. **404 on API calls** → Check routes in `server.js`
3. **Grafana iframe not loading** → Verify Grafana URL in env vars
4. **CSS/JS not loading** → Check build output

---

## Prevention for Future

1. **Always run migrations** in correct order
2. **Use environment variables** for sensitive data
3. **Monitor logs** in production (set up alerts)
4. **Test locally** before deploying to Railway
5. **Keep backups** of database schema
6. **Document** custom RLS policies

---

## Quick Links
- [Railway Docs](https://railway.app/docs)
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Grafana Integration](./GRAFANA_FRONTEND_CONNECTION_GUIDE.md)

---

**Generated**: 2025-12-30  
**Status**: All fixes documented and ready to apply
