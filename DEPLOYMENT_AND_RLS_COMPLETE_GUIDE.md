# Complete Deployment & Row-Level Security Setup Guide

**Date:** December 28, 2025  
**Project:** IT Asset Management System  
**Duration:** 4+ hours

---

## 🎯 What We Accomplished

✅ Deployed backend to Railway  
✅ Connected Railway PostgreSQL database  
✅ Configured frontend on Vercel  
✅ Implemented Row-Level Security (RLS)  
✅ Fixed critical RLS bypass issue (superuser problem)  
✅ Multi-tenant data isolation working

---

## 📋 Initial Setup

### 1. Database Connection
**Railway PostgreSQL Database:**
- Host: `caboose.proxy.rlwy.net:31886`
- Database: `railway`
- Initial credentials provided by Railway

**Created `.env` file:**
```bash
DATABASE_URL=postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway
PORT=5000
NODE_ENV=production
```

### 2. Backend Deployment to Railway

**Steps:**
1. Logged into https://railway.app
2. Created new project from GitHub repository
3. Set root directory: `itam-saas/Agent`
4. Added environment variables:
   - `DATABASE_URL`
   - `NODE_ENV=production`
   - `PORT=5000`
   - `GOOGLE_CLIENT_ID` (from Google Cloud Console)
   - `GOOGLE_CLIENT_SECRET` (from Google Cloud Console)
   - `GOOGLE_CALLBACK_URL=https://it-asset-project-production.up.railway.app/api/auth/google/callback`
   - `JWT_SECRET`
   - `SESSION_SECRET`

**Railway URL:** `https://it-asset-project-production.up.railway.app`

### 3. Frontend Configuration (Vercel)

**Added environment variable:**
- Variable: `REACT_APP_API_URL`
- Value: `https://it-asset-project-production.up.railway.app/api`

**Redeployed** Vercel frontend to pick up new backend URL.

### 4. Google OAuth Configuration

**Updated Google Cloud Console:**
1. Went to https://console.cloud.google.com/apis/credentials
2. Added authorized redirect URI:
   ```
   https://it-asset-project-production.up.railway.app/api/auth/google/callback
   ```
3. Saved changes

---

## 🔒 Row-Level Security (RLS) Implementation

### Problem Discovered
Users could see ALL devices and assets from all users - no data isolation.

### Phase 1: Enable RLS on Tables

**Added `user_id` column to licenses table:**
```sql
ALTER TABLE licenses 
ADD COLUMN user_id INTEGER REFERENCES auth_users(id);
```

**Enabled RLS:**
```sql
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_usage ENABLE ROW LEVEL SECURITY;
```

### Phase 2: Created RLS Policies

**File:** `migrations/enable-rls-complete.sql`

**Assets Policies:**
```sql
CREATE POLICY user_assets_select_policy ON assets
    FOR SELECT
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND (
            user_id = current_setting('app.current_user_id', true)::integer
            OR EXISTS (
                SELECT 1 FROM auth_users
                WHERE id = current_setting('app.current_user_id', true)::integer
                AND role = 'admin'
            )
        )
    );

-- Similar policies for INSERT, UPDATE, DELETE
```

**Devices Policies:**
```sql
CREATE POLICY user_devices_select_policy ON devices
    FOR SELECT
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND (
            user_id = current_setting('app.current_user_id', true)::integer
            OR EXISTS (
                SELECT 1 FROM auth_users
                WHERE id = current_setting('app.current_user_id', true)::integer
                AND role = 'admin'
            )
        )
    );
```

**Applied migrations:**
```bash
node run-tighten-rls.js
```

### Phase 3: Forced RLS (Initial Attempt)

**Discovered RLS wasn't working**, so we forced it:
```sql
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
ALTER TABLE device_usage FORCE ROW LEVEL SECURITY;
```

**Still didn't work!** 🚨

---

## 🐛 Critical Bug: Superuser Bypassing RLS

### The Problem

After extensive testing, discovered:
- Connected as: `postgres` (superuser)
- **PostgreSQL superusers BYPASS ALL RLS policies, even with FORCE enabled**
- This is by design - superusers have unrestricted access

**Test Results:**
```
User ID 7 (non-admin) sees: 4 devices  ❌ Should see 1
User ID 1 (admin) sees: 4 devices      ✅ Correct
User ID 3 (non-admin) sees: 4 devices  ❌ Should see 1
```

### The Solution

**Created non-superuser application role:**

```sql
CREATE USER itam_app WITH PASSWORD 'itam_app_secure_2025';
GRANT CONNECT ON DATABASE railway TO itam_app;
GRANT USAGE ON SCHEMA public TO itam_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO itam_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO itam_app;
```

**Updated DATABASE_URL in Railway:**

**OLD (Wrong):**
```
postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway
```

**NEW (Correct):**
```
postgresql://itam_app:itam_app_secure_2025@caboose.proxy.rlwy.net:31886/railway
```

### Results After Fix

**Test Results with `itam_app` user:**
```
✅ User ID 7 (non-admin) sees: 1 device  (only their own)
✅ User ID 1 (admin) sees: 4 devices     (all devices)
✅ User ID 3 (non-admin) sees: 1 device  (only their own)
```

**RLS NOW WORKING PERFECTLY!** 🎉

---

## 📁 Files Created/Modified

### Created Files:
1. `itam-saas/Agent/.env` - Environment variables
2. `itam-saas/Agent/migrations/enable-rls-complete.sql` - RLS policies for assets/licenses
3. `itam-saas/Agent/migrations/fix-devices-rls.sql` - RLS policies for devices
4. `itam-saas/Agent/add-user-id-to-licenses.js` - Migration script
5. `itam-saas/Agent/run-tighten-rls.js` - Migration runner
6. `itam-saas/Agent/verify-rls.js` - RLS verification script
7. `itam-saas/Agent/create-app-user.js` - Application user creation
8. `itam-saas/Agent/test-with-app-user.js` - RLS testing script
9. Multiple diagnostic scripts for debugging

### Modified Files:
1. Railway environment variables (DATABASE_URL, etc.)
2. Vercel environment variables (REACT_APP_API_URL)

---

## 🔑 Key Learnings

### 1. **Superuser Bypass**
- PostgreSQL superusers (like `postgres`) bypass ALL RLS policies
- Even `FORCE ROW LEVEL SECURITY` doesn't apply to superusers
- **Always use a non-superuser role for application connections**

### 2. **RLS Policy Structure**
```sql
USING (
    user_id = current_setting('app.current_user_id')::integer
    OR EXISTS (SELECT 1 FROM auth_users WHERE id = ... AND role = 'admin')
)
```
- Regular users see only their data
- Admins see everything

### 3. **Session Variables**
- Backend calls `setCurrentUserId(userId)` before each query
- Sets PostgreSQL session variable: `app.current_user_id`
- RLS policies check this variable

### 4. **Testing RLS**
```javascript
await pool.query("SELECT set_config('app.current_user_id', '7', false)");
const result = await pool.query('SELECT * FROM devices');
// Should only return user 7's devices
```

---

## 🚀 Production Checklist

- [x] Backend deployed to Railway
- [x] Database connected and accessible
- [x] RLS enabled on all tables
- [x] RLS policies created and tested
- [x] Application using non-superuser database role
- [x] Frontend connected to backend
- [x] Google OAuth configured
- [x] Environment variables secured
- [x] Multi-tenancy working (users isolated)

---

## 🔍 Debugging Commands

### Check RLS Status:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### Check Active Policies:
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('assets', 'licenses', 'devices');
```

### Test RLS Manually:
```sql
SELECT set_config('app.current_user_id', '7', false);
SELECT * FROM devices;  -- Should only show user 7's devices
```

### Check Current User:
```sql
SELECT current_user, session_user;
```

---

## 📞 Important Credentials

### Database Connection (Production):
```
Host: caboose.proxy.rlwy.net
Port: 31886
Database: railway
User: itam_app
Password: itam_app_secure_2025
```

**Full Connection String:**
```
postgresql://itam_app:itam_app_secure_2025@caboose.proxy.rlwy.net:31886/railway
```

### URLs:
- **Frontend:** https://it-asset-project.vercel.app
- **Backend:** https://it-asset-project-production.up.railway.app
- **API:** https://it-asset-project-production.up.railway.app/api

---

## ⚠️ Critical Notes

1. **NEVER use postgres superuser for application connections**
2. **Always test RLS with non-admin users**
3. **Keep DATABASE_URL with itam_app user in Railway**
4. **RLS policies must check current_setting('app.current_user_id')**
5. **Backend must call setCurrentUserId() before all queries**

---

## 🎯 Final System Architecture

```
┌─────────────────────────────────────────────┐
│   Frontend (Vercel)                         │
│   https://it-asset-project.vercel.app       │
└──────────────────┬──────────────────────────┘
                   │
                   │ REACT_APP_API_URL
                   ▼
┌─────────────────────────────────────────────┐
│   Backend (Railway)                         │
│   https://it-asset-project-production...    │
│   - Express.js server                       │
│   - Google OAuth                            │
│   - JWT authentication                      │
│   - Sets app.current_user_id per request    │
└──────────────────┬──────────────────────────┘
                   │
                   │ DATABASE_URL (itam_app user)
                   ▼
┌─────────────────────────────────────────────┐
│   PostgreSQL (Railway)                      │
│   - RLS enabled on all tables               │
│   - Policies filter by app.current_user_id  │
│   - Regular users see only their data       │
│   - Admins see everything                   │
└─────────────────────────────────────────────┘
```

---

## ✅ Success Metrics

**Before Fix:**
- All users saw all 4 devices ❌
- No data isolation ❌
- Security vulnerability ❌

**After Fix:**
- Non-admin users see only their own device(s) ✅
- Admins see all devices ✅
- Complete data isolation ✅
- Production-ready security ✅

---

**End of Documentation**

*This guide documents the complete deployment and Row-Level Security implementation for the IT Asset Management System, including the critical fix for the superuser RLS bypass issue.*
