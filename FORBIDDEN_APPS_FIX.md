# Forbidden Apps Feature - Fix Guide

## Problem Summary
The forbidden apps feature is failing with a 404 error because the Vercel deployment doesn't have the backend API URL configured as an environment variable.

## What Was Fixed

### 1. Database Migration ✅
The forbidden apps tables were successfully created in the Railway database:
- `forbidden_apps` table
- `security_alerts` table
- PostgreSQL NOTIFY triggers
- 7 default forbidden apps

**Test Result:** ✅ API is working on Railway
```
https://it-asset-project-production.up.railway.app/api/forbidden-apps
```

### 2. Code Verification ✅
- All backend endpoints exist in `server.js`
- All database queries exist in `queries.js`
- Frontend component `ForbiddenApps.jsx` is correctly implemented
- Migration script `run-forbidden-migration.js` executed successfully

### 3. Database Table Verification Updated ✅
Updated `queries.js` `initDatabase()` function to check for forbidden_apps and security_alerts tables.

## Root Cause
The Vercel frontend deployment is missing the `REACT_APP_API_URL` environment variable, causing it to make API requests to the wrong URL (frontend URL instead of backend URL).

## How to Fix

### Option 1: Configure Vercel Environment Variable (Recommended)

1. Go to your Vercel project dashboard: https://vercel.com/dashboard
2. Select your project: `it-asset-project`
3. Go to **Settings** → **Environment Variables**
4. Add a new environment variable:
   - **Name:** `REACT_APP_API_URL`
   - **Value:** `https://it-asset-project-production.up.railway.app`
   - **Environment:** Production, Preview, Development (select all)
5. Click **Save**
6. Go to **Deployments** tab
7. Click **Redeploy** on the latest deployment

### Option 2: Update vercel.json

Add environment configuration to `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "env": {
    "REACT_APP_API_URL": "https://it-asset-project-production.up.railway.app"
  }
}
```

Then redeploy to Vercel.

### Option 3: Local Testing

If you want to test locally first:

1. Make sure you're in the Client directory:
   ```powershell
   cd itam-saas\Client
   ```

2. The `.env` file already exists with the correct URL. Just rebuild:
   ```powershell
   npm install
   npm start
   ```

3. Login with admin credentials:
   - **Username:** admin
   - **Password:** admin123

4. Navigate to "Forbidden Apps" section

## Verification Steps

After deploying with the environment variable:

1. Open the deployed Vercel app
2. Open browser DevTools (F12)
3. Go to the Network tab
4. Navigate to Forbidden Apps
5. Check that the API request goes to: 
   `https://it-asset-project-production.up.railway.app/api/forbidden-apps`
   (NOT to `it-asset-project.vercel.app/forbidden-apps`)

## Expected Result

After the fix, you should see:
- ✅ List of 7 default forbidden applications
- ✅ Ability to add new forbidden apps (admin only)
- ✅ Ability to delete forbidden apps (admin only)
- ✅ Severity levels displayed with colors

## Default Forbidden Apps Created

1. **mimikatz.exe** - Critical - Password dumping tool
2. **nmap.exe** - High - Network scanning tool
3. **wireshark.exe** - High - Packet analyzer
4. **torrent.exe** - Medium - BitTorrent client
5. **utorrent.exe** - Medium - BitTorrent client
6. **poker.exe** - Low - Gambling software
7. **steam.exe** - Low - Gaming platform

## Technical Details

### Backend (Railway)
- **Status:** ✅ Working
- **URL:** https://it-asset-project-production.up.railway.app
- **Endpoints:**
  - GET `/api/forbidden-apps` - List all forbidden apps
  - POST `/api/forbidden-apps` - Create new (admin only)
  - PUT `/api/forbidden-apps/:id` - Update (admin only)
  - DELETE `/api/forbidden-apps/:id` - Delete (admin only)
  - GET `/api/alerts` - Get security alerts
  - POST `/api/alerts` - Report security alert

### Frontend (Vercel)
- **Status:** ⚠️ Needs environment variable
- **URL:** https://it-asset-project.vercel.app
- **Issue:** Missing `REACT_APP_API_URL` environment variable

### Database (Railway PostgreSQL)
- **Status:** ✅ Tables created
- **Tables:**
  - `forbidden_apps` - Admin-managed list of forbidden applications
  - `security_alerts` - Violation records from agents

## Support Files Created

- `test-forbidden-api.js` - API testing script (verified working)
- `FORBIDDEN_APPS_FIX.md` - This guide

## Questions?

If you still see issues after setting the environment variable:
1. Check browser console for exact error messages
2. Verify the Network tab shows correct API URL
3. Ensure you're logged in as admin
4. Clear browser cache and hard reload (Ctrl+Shift+R)
