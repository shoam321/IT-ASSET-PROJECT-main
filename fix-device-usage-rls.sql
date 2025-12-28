-- ========================================
-- FIX: device_usage INSERT Policy
-- ========================================
-- Run this on Railway PostgreSQL to fix the RLS error

-- Step 1: Check current policies
SELECT 
  policyname, 
  cmd, 
  CASE 
    WHEN cmd = 'INSERT' THEN 'WITH CHECK: ' || with_check
    ELSE 'USING: ' || qual
  END as policy_clause
FROM pg_policies 
WHERE tablename = 'device_usage'
ORDER BY cmd;

-- Step 2: Check RLS status
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'device_usage';

-- Step 3: Drop and recreate INSERT policy
DROP POLICY IF EXISTS user_usage_insert_policy ON device_usage;

CREATE POLICY user_usage_insert_policy ON device_usage
  FOR INSERT
  WITH CHECK (
    -- Ensure app.current_user_id is set
    current_setting('app.current_user_id', true) IS NOT NULL
    AND current_setting('app.current_user_id', true) != ''
    -- User can only insert their own usage data
    AND user_id = current_setting('app.current_user_id', true)::integer
  );

-- Step 4: Verify the policy was created
SELECT 
  policyname, 
  cmd,
  with_check 
FROM pg_policies 
WHERE tablename = 'device_usage' AND cmd = 'INSERT';

-- Step 5: Test the policy
-- Set user context
SET app.current_user_id = '7';

-- Try to insert (should succeed)
INSERT INTO device_usage (device_id, app_name, window_title, duration, timestamp, user_id)
VALUES ('TEST-DEVICE', 'Test App', 'Test Window', 100, NOW(), 7)
RETURNING device_id, app_name, user_id;

-- Clean up test data
DELETE FROM device_usage WHERE device_id = 'TEST-DEVICE';

-- Reset context
RESET app.current_user_id;

-- ========================================
-- Expected Output:
-- ========================================
-- ✅ INSERT policy created
-- ✅ Test insert succeeded
-- ✅ device_usage RLS is working
