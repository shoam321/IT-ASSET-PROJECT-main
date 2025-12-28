-- ═══════════════════════════════════════════════════════════════
-- FIX: Device Visibility Issue - Simple Version for Railway
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Assign NULL devices to admin
DO $$
DECLARE
    admin_user_id INTEGER;
BEGIN
    SELECT id INTO admin_user_id 
    FROM auth_users 
    WHERE role = 'admin' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF admin_user_id IS NOT NULL THEN
        UPDATE devices SET user_id = admin_user_id WHERE user_id IS NULL;
        UPDATE device_usage SET user_id = admin_user_id WHERE user_id IS NULL;
    END IF;
END $$;

-- Step 2: Apply fail-secure RLS policies for DEVICES
DROP POLICY IF EXISTS user_devices_select_policy ON devices;
CREATE POLICY user_devices_select_policy ON devices
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

-- Step 3: Apply fail-secure RLS policies for DEVICE_USAGE
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

-- Done! Now restart your backend server on Railway.
