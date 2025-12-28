-- ========================================
-- FIX: device_usage INSERT RLS Policy
-- ========================================
-- Run this SQL on Railway PostgreSQL to fix the RLS violation error
-- Error: "new row violates row-level security policy for table device_usage"

-- Step 1: Check current RLS policies
SELECT '=== CURRENT DEVICE_USAGE POLICIES ===' as step;
SELECT 
  policyname, 
  cmd, 
  with_check,
  qual
FROM pg_policies 
WHERE tablename = 'device_usage'
ORDER BY cmd, policyname;

-- Step 2: Check if RLS is enabled
SELECT '=== RLS STATUS ===' as step;
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'device_usage';

-- Step 3: Check sample device ownership
SELECT '=== DEVICE OWNERSHIP SAMPLE ===' as step;
SELECT device_id, user_id, hostname
FROM devices
LIMIT 5;

-- Step 4: Drop and recreate INSERT policy with device ownership check
SELECT '=== RECREATING INSERT POLICY ===' as step;

DROP POLICY IF EXISTS user_usage_insert_policy ON device_usage;

CREATE POLICY user_usage_insert_policy ON device_usage
  FOR INSERT
  WITH CHECK (
    -- Ensure RLS context is set
    current_setting('app.current_user_id', true) IS NOT NULL
    AND current_setting('app.current_user_id', true) != ''
    AND (
      -- Case 1: User inserting their own usage data
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

-- Step 5: Verify the new policy
SELECT '=== NEW POLICY ===' as step;
SELECT 
  policyname, 
  cmd,
  with_check 
FROM pg_policies 
WHERE tablename = 'device_usage' AND cmd = 'INSERT';

-- Step 6: Test the policy (optional - comment out if you don't want to test)
/*
-- Set user context to user 7
SET app.current_user_id = '7';

-- Check user 7's devices
SELECT 'User 7 devices:' as test;
SELECT device_id, user_id FROM devices WHERE user_id = 7 LIMIT 3;

-- Try to insert usage data for user 7's device (should succeed if device exists)
INSERT INTO device_usage (device_id, app_name, window_title, duration, timestamp, user_id)
SELECT 
  device_id,
  'Test App - RLS Fix',
  'Test Window', 
  100, 
  NOW(), 
  7
FROM devices 
WHERE user_id = 7 
LIMIT 1
RETURNING device_id, app_name, user_id;

-- Clean up test data
DELETE FROM device_usage WHERE app_name = 'Test App - RLS Fix';

-- Reset context
RESET app.current_user_id;

SELECT '✅ Test completed successfully!' as result;
*/

SELECT '=== FIX COMPLETE ===' as step;
SELECT 'The device_usage INSERT policy has been updated.' as result;
SELECT 'Users can now insert usage data for their own devices.' as result;
SELECT 'Admins can insert usage data for any device.' as result;
