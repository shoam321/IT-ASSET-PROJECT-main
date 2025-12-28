-- Migration: Fix device ownership claim under RLS
-- Purpose: Allow a logged-in user to "claim" devices that are unowned (user_id IS NULL)
--          or were auto-assigned to the bootstrap admin during migration.
--          Prevents regular users from stealing devices owned by other regular users.
-- Date: December 28, 2025

-- NOTE:
-- This changes ONLY the UPDATE policy for devices.
-- INSERT policy already requires user_id == app.current_user_id (or requester is admin).

DROP POLICY IF EXISTS user_devices_update_policy ON devices;

CREATE POLICY user_devices_update_policy ON devices
  FOR UPDATE
  USING (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND current_setting('app.current_user_id', true) != ''
    AND (
      -- Update own device
      user_id = current_setting('app.current_user_id', true)::integer
      OR
      -- Admin can update any device
      EXISTS (
        SELECT 1 FROM auth_users
        WHERE id = current_setting('app.current_user_id', true)::integer
          AND role = 'admin'
      )
      OR
      -- Allow claiming unowned devices
      user_id IS NULL
      OR
      -- Allow claiming devices owned by bootstrap admin (common after migration)
      EXISTS (
        SELECT 1 FROM auth_users owner
        WHERE owner.id = devices.user_id
          AND owner.role = 'admin'
      )
    )
  )
  WITH CHECK (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND current_setting('app.current_user_id', true) != ''
    AND (
      -- After update, device must belong to requester
      user_id = current_setting('app.current_user_id', true)::integer
      OR
      -- Or requester is admin
      EXISTS (
        SELECT 1 FROM auth_users
        WHERE id = current_setting('app.current_user_id', true)::integer
          AND role = 'admin'
      )
    )
  );

COMMENT ON POLICY user_devices_update_policy ON devices IS
'RLS: Users can update their own devices; admins can update all. Users may claim devices that are unowned or owned by bootstrap admin; users cannot steal devices owned by other regular users.';
