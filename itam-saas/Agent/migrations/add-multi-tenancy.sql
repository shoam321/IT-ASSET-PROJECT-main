-- Migration: Add Multi-Tenancy Support
-- Description: Adds role-based access control and data isolation per user
-- Date: December 25, 2025

-- 1. Add created_by column to auth_users table (role already exists)
ALTER TABLE auth_users
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES auth_users(id);

-- Set existing admin user to admin role (if not already set)
UPDATE auth_users SET role = 'admin' WHERE username = 'admin' AND role != 'admin';

-- 2. Add user_id to devices table (ownership)
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- 3. Add user_id to device_usage table
ALTER TABLE device_usage 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_device_usage_user_id ON device_usage(user_id);

-- 4. Enable Row-Level Security (PostgreSQL's built-in security feature)
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_usage ENABLE ROW LEVEL SECURITY;

-- 5. Create Row-Level Security Policies

-- Policy: Users can only SELECT their own devices, admins see all
DROP POLICY IF EXISTS user_devices_select_policy ON devices;
CREATE POLICY user_devices_select_policy ON devices
    FOR SELECT
    USING (
        user_id = current_setting('app.current_user_id', true)::integer
        OR 
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Users can only INSERT devices for themselves
DROP POLICY IF EXISTS user_devices_insert_policy ON devices;
CREATE POLICY user_devices_insert_policy ON devices
    FOR INSERT
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::integer
        OR 
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Users can only UPDATE their own devices
DROP POLICY IF EXISTS user_devices_update_policy ON devices;
CREATE POLICY user_devices_update_policy ON devices
    FOR UPDATE
    USING (
        user_id = current_setting('app.current_user_id', true)::integer
        OR 
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Users can only SELECT their own usage data
DROP POLICY IF EXISTS user_usage_select_policy ON device_usage;
CREATE POLICY user_usage_select_policy ON device_usage
    FOR SELECT
    USING (
        user_id = current_setting('app.current_user_id', true)::integer
        OR 
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Users can only INSERT their own usage data
DROP POLICY IF EXISTS user_usage_insert_policy ON device_usage;
CREATE POLICY user_usage_insert_policy ON device_usage
    FOR INSERT
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::integer
        OR 
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- 6. Create helper function to set current user context
CREATE OR REPLACE FUNCTION set_current_user_id(user_id INTEGER)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id::text, false);
END;
$$ LANGUAGE plpgsql;

-- 7. Update existing devices to belong to admin user (for migration)
-- Get admin user id
DO $$
DECLARE
    admin_user_id INTEGER;
BEGIN
    SELECT id INTO admin_user_id FROM auth_users WHERE role = 'admin' LIMIT 1;
    
    IF admin_user_id IS NOT NULL THEN
        UPDATE devices SET user_id = admin_user_id WHERE user_id IS NULL;
        UPDATE device_usage SET user_id = admin_user_id WHERE user_id IS NULL;
    END IF;
END $$;

-- 8. Make user_id NOT NULL after migration (enforce data integrity)
ALTER TABLE devices ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE device_usage ALTER COLUMN user_id SET NOT NULL;

COMMENT ON COLUMN auth_users.role IS 'User role: admin (see all) or user (see only own data)';
COMMENT ON COLUMN auth_users.created_by IS 'ID of admin user who created this account';
COMMENT ON COLUMN devices.user_id IS 'Owner of this device';
COMMENT ON COLUMN device_usage.user_id IS 'Owner of this usage data';
