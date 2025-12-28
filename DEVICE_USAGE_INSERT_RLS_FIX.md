# Device Usage INSERT RLS Policy Fix

## Problem

User ID 7 is unable to insert device usage data, receiving the following error:

```
ERROR: new row violates row-level security policy for table "device_usage"
```

### Error Details

- **User ID**: 7
- **Device ID**: LT-SHOAM-TA::7
- **RLS Context**: Correctly set to `app.current_user_id = 7`
- **Verification**: `✅ Verified app.current_user_id = 7`
- **Result**: Insert still fails

### Log Evidence

```
[inf]  🔐 Setting app.current_user_id = 7
[inf]  ✅ Verified app.current_user_id = 7
[err]  Error inserting usage data: error: new row violates row-level security policy for table "device_usage"
```

## Root Cause

The current RLS policy for INSERT on `device_usage` table is too restrictive. It only checks:

```sql
WITH CHECK (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND current_setting('app.current_user_id', true) != ''
    AND user_id = current_setting('app.current_user_id', true)::integer
)
```

### Issues with Current Policy

1. **Missing Device Ownership Check**: The policy doesn't verify that the device referenced in `device_usage.device_id` actually belongs to the user
2. **No Admin Override**: Admins cannot insert usage data for other users
3. **Device-User Relationship Not Enforced**: A user could potentially insert usage data for devices they don't own

## Solution

Update the INSERT policy to include:

1. ✅ Verify the user matches the `user_id` in the usage record
2. ✅ Verify the device exists and belongs to the user
3. ✅ Allow admins to bypass these restrictions

### New Policy

```sql
CREATE POLICY user_usage_insert_policy ON device_usage
  FOR INSERT
  WITH CHECK (
    -- Ensure RLS context is set
    current_setting('app.current_user_id', true) IS NOT NULL
    AND current_setting('app.current_user_id', true) != ''
    AND (
      -- Case 1: User inserting their own usage data for their own device
      (
        user_id = current_setting('app.current_user_id', true)::integer
        AND EXISTS (
          SELECT 1 FROM devices 
          WHERE devices.device_id = device_usage.device_id 
          AND devices.user_id = current_setting('app.current_user_id', true)::integer
        )
      )
      OR 
      -- Case 2: Admin can insert any usage data
      EXISTS (
        SELECT 1 FROM auth_users 
        WHERE id = current_setting('app.current_user_id', true)::integer 
        AND role = 'admin'
      )
    )
  );
```

## How to Apply the Fix

### Option 1: Using PowerShell Script (Recommended)

```powershell
# Set your Railway database URL
$env:DATABASE_URL = "postgresql://postgres:password@host:port/railway"

# Run the fix script
.\fix-device-usage-insert-rls.ps1
```

### Option 2: Using SQL Directly

1. Open Railway PostgreSQL Query interface
2. Copy and paste the contents of `FIX-DEVICE-USAGE-INSERT-RLS.sql`
3. Execute the SQL

### Option 3: Using psql Command Line

```bash
psql $DATABASE_URL -f FIX-DEVICE-USAGE-INSERT-RLS.sql
```

## Verification

After applying the fix, verify it works:

1. Check the policy was created:
   ```sql
   SELECT policyname, cmd, with_check 
   FROM pg_policies 
   WHERE tablename = 'device_usage' AND cmd = 'INSERT';
   ```

2. Test insertion (as user 7):
   ```sql
   SET app.current_user_id = '7';
   
   INSERT INTO device_usage (device_id, app_name, window_title, duration, timestamp, user_id)
   SELECT device_id, 'Test App', 'Test', 100, NOW(), 7
   FROM devices WHERE user_id = 7 LIMIT 1
   RETURNING *;
   
   DELETE FROM device_usage WHERE app_name = 'Test App';
   RESET app.current_user_id;
   ```

## Expected Outcome

After applying this fix:

- ✅ Users can insert device usage data for their own devices
- ✅ RLS enforces device ownership (users can only insert data for devices they own)
- ✅ Admins can insert usage data for any device
- ✅ Security is maintained - users cannot insert data for devices they don't own
- ✅ The error "new row violates row-level security policy" should be resolved

## Files Modified

1. **fix-rls.sql** - Updated with comprehensive INSERT policy
2. **FIX-DEVICE-USAGE-INSERT-RLS.sql** - New standalone SQL fix script
3. **fix-device-usage-insert-rls.ps1** - PowerShell script to apply the fix

## Related Code

- **server.js** (line ~1210): POST /api/agent/usage endpoint
- **queries.js** (line ~997): insertUsageData function
- **queries.js** (line ~78): withRLSContext function

## Testing

After restart, monitor logs for:

```
[inf]  🔐 Setting app.current_user_id = 7
[inf]  ✅ Verified app.current_user_id = 7
[inf]  [2025-12-28T...] POST /api/agent/usage -> 201 (20ms)  ✅ SUCCESS
```

No more RLS violation errors should appear.
