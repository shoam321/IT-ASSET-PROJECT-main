-- FIX: Secure RLS Policies (Fail-Secure by Default)
-- This fixes the security breach where null current_user_id shows all data

-- ==================================================================
-- CRITICAL FIX: Devices Table - Fail-Secure RLS
-- ==================================================================

-- Drop old insecure policy
DROP POLICY IF EXISTS user_devices_select_policy ON devices;

-- Create NEW fail-secure policy
-- If app.current_user_id is NOT set or NULL -> DENY ACCESS (returns 0 rows)
-- If app.current_user_id is set -> Check if user_id matches OR user is admin
CREATE POLICY user_devices_select_policy ON devices
    FOR SELECT
    USING (
        -- Fail-secure: Require current_setting to NOT be null/empty
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND (
            -- Match user_id
            user_id = current_setting('app.current_user_id', true)::integer
            OR 
            -- OR user is admin
            EXISTS (
                SELECT 1 FROM auth_users 
                WHERE id = current_setting('app.current_user_id', true)::integer 
                AND role = 'admin'
            )
        )
    );

-- ==================================================================
-- Device Usage Table - Fail-Secure RLS
-- ==================================================================

DROP POLICY IF EXISTS user_usage_select_policy ON device_usage;

CREATE POLICY user_usage_select_policy ON device_usage
    FOR SELECT
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND (
            user_id = current_setting('app.current_user_id', true)::integer
            OR 
            EXISTS (
                SELECT 1 FROM auth_users 
                WHERE id = current_setting('app.current_user_id', true)::integer 
                AND role = 'admin'
            )
        )
    );

-- ==================================================================
-- INSERT/UPDATE Policies - Fail-Secure
-- ==================================================================

DROP POLICY IF EXISTS user_devices_insert_policy ON devices;
CREATE POLICY user_devices_insert_policy ON devices
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND (
            user_id = current_setting('app.current_user_id', true)::integer
            OR 
            EXISTS (
                SELECT 1 FROM auth_users 
                WHERE id = current_setting('app.current_user_id', true)::integer 
                AND role = 'admin'
            )
        )
    );

DROP POLICY IF EXISTS user_devices_update_policy ON devices;
CREATE POLICY user_devices_update_policy ON devices
    FOR UPDATE
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND (
            user_id = current_setting('app.current_user_id', true)::integer
            OR 
            EXISTS (
                SELECT 1 FROM auth_users 
                WHERE id = current_setting('app.current_user_id', true)::integer 
                AND role = 'admin'
            )
        )
    );

DROP POLICY IF EXISTS user_usage_insert_policy ON device_usage;
CREATE POLICY user_usage_insert_policy ON device_usage
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND (
            user_id = current_setting('app.current_user_id', true)::integer
            OR 
            EXISTS (
                SELECT 1 FROM auth_users 
                WHERE id = current_setting('app.current_user_id', true)::integer 
                AND role = 'admin'
            )
        )
    );

-- ==================================================================
-- VERIFICATION
-- ==================================================================

COMMENT ON POLICY user_devices_select_policy ON devices IS 
'Fail-secure RLS: Denies access if app.current_user_id is not set. Users see only their devices, admins see all.';

COMMENT ON POLICY user_usage_select_policy ON device_usage IS
'Fail-secure RLS: Denies access if app.current_user_id is not set. Users see only their usage, admins see all.';
