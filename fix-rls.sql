-- ========================================
-- FIX: device_usage INSERT Policy  
-- ========================================
-- This fixes the RLS error when inserting device usage data

-- Step 1: Drop existing INSERT policy
DROP POLICY IF EXISTS user_usage_insert_policy ON device_usage;

-- Step 2: Create comprehensive INSERT policy
-- Allow users to insert their own usage data OR allow admins to insert any usage data
CREATE POLICY user_usage_insert_policy ON device_usage
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND current_setting('app.current_user_id', true) != ''
    AND (
      -- User can insert their own usage data
      user_id = current_setting('app.current_user_id', true)::integer
      OR 
      -- Admin can insert any usage data
      EXISTS (
        SELECT 1 FROM auth_users 
        WHERE id = current_setting('app.current_user_id', true)::integer 
        AND role = 'admin'
      )
    )
    AND (
      -- Verify the device exists and belongs to the user (or admin can insert for any device)
      EXISTS (
        SELECT 1 FROM devices 
        WHERE device_id = device_usage.device_id 
        AND (
          devices.user_id = current_setting('app.current_user_id', true)::integer
          OR EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
          )
        )
      )
    )
  );

-- Step 3: Verify the policy was created
SELECT 
  policyname, 
  cmd,
  with_check 
FROM pg_policies 
WHERE tablename = 'device_usage' AND cmd = 'INSERT';
