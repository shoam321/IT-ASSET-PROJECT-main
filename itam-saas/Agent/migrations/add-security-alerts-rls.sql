-- Migration: Enable RLS on security_alerts
-- Description: Prevent non-admin users from seeing other users' security alerts
-- Date: 2025-12-28

-- Enable Row-Level Security
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only SELECT their own alerts; admins see all
DROP POLICY IF EXISTS user_security_alerts_select_policy ON security_alerts;
CREATE POLICY user_security_alerts_select_policy ON security_alerts
  FOR SELECT
  USING (
    user_id = current_setting('app.current_user_id', true)::integer
    OR EXISTS (
      SELECT 1 FROM auth_users
      WHERE id = current_setting('app.current_user_id', true)::integer
        AND role = 'admin'
    )
  );

-- Policy: Users can only INSERT alerts for themselves; admins can insert any
DROP POLICY IF EXISTS user_security_alerts_insert_policy ON security_alerts;
CREATE POLICY user_security_alerts_insert_policy ON security_alerts
  FOR INSERT
  WITH CHECK (
    user_id = current_setting('app.current_user_id', true)::integer
    OR EXISTS (
      SELECT 1 FROM auth_users
      WHERE id = current_setting('app.current_user_id', true)::integer
        AND role = 'admin'
    )
  );

-- Policy: Users can only UPDATE their own alerts; admins can update any
DROP POLICY IF EXISTS user_security_alerts_update_policy ON security_alerts;
CREATE POLICY user_security_alerts_update_policy ON security_alerts
  FOR UPDATE
  USING (
    user_id = current_setting('app.current_user_id', true)::integer
    OR EXISTS (
      SELECT 1 FROM auth_users
      WHERE id = current_setting('app.current_user_id', true)::integer
        AND role = 'admin'
    )
  );
