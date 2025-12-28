-- Fix devices and device_usage RLS policies

-- Drop and recreate devices policies
DROP POLICY IF EXISTS user_devices_select_policy ON devices;
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

DROP POLICY IF EXISTS user_devices_insert_policy ON devices;
CREATE POLICY user_devices_insert_policy ON devices
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND user_id = current_setting('app.current_user_id', true)::integer
    );

DROP POLICY IF EXISTS user_devices_update_policy ON devices;
CREATE POLICY user_devices_update_policy ON devices
    FOR UPDATE
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

-- device_usage should follow the same user_id from devices
DROP POLICY IF EXISTS user_device_usage_select_policy ON device_usage;
CREATE POLICY user_device_usage_select_policy ON device_usage
    FOR SELECT
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND (
            EXISTS (
                SELECT 1 FROM devices
                WHERE devices.device_id = device_usage.device_id
                AND devices.user_id = current_setting('app.current_user_id', true)::integer
            )
            OR EXISTS (
                SELECT 1 FROM auth_users
                WHERE id = current_setting('app.current_user_id', true)::integer
                AND role = 'admin'
            )
        )
    );
