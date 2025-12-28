-- Drop and recreate the INSERT policy for device_usage
DROP POLICY IF EXISTS user_usage_insert_policy ON device_usage;

CREATE POLICY user_usage_insert_policy ON device_usage
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND current_setting('app.current_user_id', true) != ''
    AND user_id = current_setting('app.current_user_id', true)::integer
  );
