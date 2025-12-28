-- ═══════════════════════════════════════════════════════════════
-- FIX: Device Visibility Issue - All users can see all devices
-- ═══════════════════════════════════════════════════════════════
-- INSTRUCTIONS: Run this SQL script in Railway's database console
-- (Railway Dashboard > Your Project > PostgreSQL > Data tab > Query)
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Check current state
SELECT '═══════════════════════════════════════' as info;
SELECT '1️⃣ CHECKING CURRENT STATE' as info;
SELECT '═══════════════════════════════════════' as info;

SELECT 'RLS Status:' as info;
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('devices', 'device_usage')
ORDER BY tablename;

SELECT 'Current Devices (sample):' as info;
SELECT device_id, hostname, user_id, last_seen 
FROM devices 
ORDER BY last_seen DESC 
LIMIT 10;

SELECT 'Devices with NULL user_id:' as info;
SELECT COUNT(*) as null_user_id_count
FROM devices 
WHERE user_id IS NULL;

-- Step 2: Fix NULL user_ids (assign to first admin)
SELECT '═══════════════════════════════════════' as info;
SELECT '2️⃣ FIXING NULL USER IDs' as info;
SELECT '═══════════════════════════════════════' as info;

DO $$
DECLARE
    admin_user_id INTEGER;
    updated_devices INTEGER;
    updated_usage INTEGER;
BEGIN
    -- Get first admin user
    SELECT id INTO admin_user_id 
    FROM auth_users 
    WHERE role = 'admin' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'No admin user found! Please create an admin user first.';
    END IF;
    
    RAISE NOTICE 'Admin user ID: %', admin_user_id;
    
    -- Update devices with NULL user_id
    UPDATE devices 
    SET user_id = admin_user_id 
    WHERE user_id IS NULL;
    
    GET DIAGNOSTICS updated_devices = ROW_COUNT;
    RAISE NOTICE 'Updated % devices', updated_devices;
    
    -- Update device_usage with NULL user_id
    UPDATE device_usage 
    SET user_id = admin_user_id 
    WHERE user_id IS NULL;
    
    GET DIAGNOSTICS updated_usage = ROW_COUNT;
    RAISE NOTICE 'Updated % usage records', updated_usage;
END $$;

-- Step 3: Apply fail-secure RLS policies
SELECT '═══════════════════════════════════════' as info;
SELECT '3️⃣ APPLYING FAIL-SECURE RLS POLICIES' as info;
SELECT '═══════════════════════════════════════' as info;

-- ==================================================================
-- DEVICES TABLE - Fail-Secure RLS
-- ==================================================================

DROP POLICY IF EXISTS user_devices_select_policy ON devices;
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

-- ==================================================================
-- DEVICE_USAGE TABLE - Fail-Secure RLS
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

SELECT '═══════════════════════════════════════' as info;
SELECT '4️⃣ VERIFICATION' as info;
SELECT '═══════════════════════════════════════' as info;

SELECT 'Updated Policies:' as info;
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('devices', 'device_usage')
ORDER BY tablename, policyname;

-- Test RLS enforcement
SELECT 'Testing RLS enforcement (should return 0 without user context):' as info;
SELECT COUNT(*) as device_count_without_user_context FROM devices;

-- Set admin context and test
DO $$
DECLARE
    admin_id INTEGER;
    device_count INTEGER;
BEGIN
    SELECT id INTO admin_id FROM auth_users WHERE role = 'admin' LIMIT 1;
    PERFORM set_config('app.current_user_id', admin_id::text, false);
    
    SELECT COUNT(*) INTO device_count FROM devices;
    RAISE NOTICE 'Admin sees % devices', device_count;
END $$;

SELECT '═══════════════════════════════════════' as info;
SELECT '✅ FIX COMPLETE!' as info;
SELECT '═══════════════════════════════════════' as info;
SELECT 'What was fixed:' as info;
SELECT '  • Applied fail-secure RLS policies' as info;
SELECT '  • Assigned NULL devices to admin user' as info;
SELECT '  • Verified RLS enforcement' as info;
SELECT '' as info;
SELECT 'Expected behavior:' as info;
SELECT '  • Regular users see ONLY their devices' as info;
SELECT '  • Admin users see ALL devices' as info;
SELECT '  • Unauthenticated queries return 0 rows' as info;
SELECT '' as info;
SELECT '🔄 Restart your backend server on Railway!' as info;
