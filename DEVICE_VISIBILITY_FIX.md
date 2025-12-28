# 🔧 FIX: Device Visibility Issue

## Problem
**All users can see ALL devices in the Usage Monitor**, instead of only their own devices.

## Root Cause
The Row-Level Security (RLS) policies on the `devices` and `device_usage` tables are either:
1. Not properly applied/enforced on the production database
2. Have NULL `user_id` values that bypass the policies

## Solution

### Step 1: Apply the SQL Fix on Railway

1. **Go to Railway Dashboard**
   - Navigate to: https://railway.app/
   - Select your project
   - Click on your **PostgreSQL** service

2. **Open the Data Tab**
   - Click on the "Data" tab
   - Click "Query" button (top right)

3. **Run the Fix Script**
   - Copy the ENTIRE content from:
     ```
     itam-saas/Agent/migrations/FIX-DEVICE-VISIBILITY-RUN-ON-RAILWAY.sql
     ```
   - Paste it into the query editor
   - Click "Run Query" or press Ctrl+Enter

4. **Verify Success**
   - You should see output showing:
     - ✅ NULL user_ids fixed
     - ✅ RLS policies applied
     - ✅ Verification tests passed

### Step 2: Restart Backend Server

After applying the SQL fix, restart your backend server on Railway:

1. Go to Railway Dashboard
2. Find your backend service
3. Click "Settings" → "Restart"
   
   OR
   
   Click the "⋯" menu → "Restart"

### Step 3: Test in Frontend

1. **Login as a regular user** (not admin)
   - Example: shoamtaitler@gmail.com

2. **Go to "Usage Monitor" page**

3. **Verify you see ONLY devices owned by that user**
   - Should NOT see devices from other users
   - Should NOT see ALL devices

4. **Login as admin** (if you have admin account)
   - Example: admin@itasset.local

5. **Go to "Usage Monitor" page**

6. **Verify admin sees ALL devices from ALL users**

## What the Fix Does

### 1. Assigns NULL Devices to Admin
All devices without a `user_id` are assigned to the first admin user.

### 2. Fail-Secure RLS Policies
The new policies ensure:
- **Unauthenticated requests** → See 0 rows
- **Regular users** → See only their own devices
- **Admin users** → See all devices

### 3. Policy Logic
```sql
-- For regular users
WHERE user_id = current_user_id

-- For admin users  
WHERE user_id = current_user_id OR role = 'admin'

-- Fail-secure check
WHERE current_user_id IS NOT NULL AND current_user_id != ''
```

## Verification Commands

If you want to verify the fix from your local machine:

```powershell
# Check RLS status
cd itam-saas\Agent
node emergency-security-check.js

# Check device ownership
node -e "import('./db.js').then(m => m.default.query('SELECT device_id, user_id FROM devices LIMIT 10').then(r => { console.table(r.rows); m.default.end(); }))"
```

## Rollback (if needed)

If something goes wrong, you can disable RLS temporarily:

```sql
-- Run this in Railway's Query tab
ALTER TABLE devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_usage DISABLE ROW LEVEL SECURITY;

-- This will allow all users to see all data (temporary workaround)
```

Then re-enable with proper policies after investigation.

## Permanent Solution

The RLS policies are now in place. To ensure new devices are properly assigned:

1. **When agents report data**, they should include the user's ID
2. **The backend API** already handles this in `server.js`:
   ```javascript
   await db.setCurrentUserId(userId);  // From JWT token
   await db.upsertDevice({ user_id: userId, ... });
   ```

3. **All API endpoints** set the current user context before querying

## Need Help?

If the issue persists after applying the fix:

1. Check the backend logs on Railway
2. Verify JWT tokens include `userId` field
3. Check that `authenticateToken` middleware is working
4. Verify the database connection string is correct
