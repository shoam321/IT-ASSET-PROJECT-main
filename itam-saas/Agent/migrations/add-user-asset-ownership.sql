-- Migration: Add User Ownership to Assets
-- Description: Links assets to specific users and implements Row-Level Security
-- Date: December 28, 2025

-- 1. Add user_id column to assets table (ownership)
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);

-- 2. Add user_id to licenses table (ownership)
ALTER TABLE licenses 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id);

-- 3. Add user_id to contracts table (ownership - for tracking who created it)
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);

-- 4. Enable Row-Level Security on assets, licenses, and contracts
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- 5. Create Row-Level Security Policies for ASSETS

-- Policy: Users can only SELECT their own assets, admins see all
DROP POLICY IF EXISTS user_assets_select_policy ON assets;
CREATE POLICY user_assets_select_policy ON assets
    FOR SELECT
    USING (
        user_id = current_setting('app.current_user_id', true)::integer
        OR 
        user_id IS NULL  -- Allow viewing unassigned assets
        OR
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Users can INSERT assets for themselves, admins can assign to anyone
DROP POLICY IF EXISTS user_assets_insert_policy ON assets;
CREATE POLICY user_assets_insert_policy ON assets
    FOR INSERT
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::integer
        OR
        user_id IS NULL
        OR 
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Users can only UPDATE their own assets, admins can update all
DROP POLICY IF EXISTS user_assets_update_policy ON assets;
CREATE POLICY user_assets_update_policy ON assets
    FOR UPDATE
    USING (
        user_id = current_setting('app.current_user_id', true)::integer
        OR
        user_id IS NULL
        OR 
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Only admins can delete assets
DROP POLICY IF EXISTS user_assets_delete_policy ON assets;
CREATE POLICY user_assets_delete_policy ON assets
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- 6. Create Row-Level Security Policies for LICENSES

-- Policy: Users can only SELECT their own licenses, admins see all
DROP POLICY IF EXISTS user_licenses_select_policy ON licenses;
CREATE POLICY user_licenses_select_policy ON licenses
    FOR SELECT
    USING (
        user_id = current_setting('app.current_user_id', true)::integer
        OR
        user_id IS NULL  -- Allow viewing unassigned licenses
        OR 
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Only admins can create licenses
DROP POLICY IF EXISTS user_licenses_insert_policy ON licenses;
CREATE POLICY user_licenses_insert_policy ON licenses
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Only admins can update licenses
DROP POLICY IF EXISTS user_licenses_update_policy ON licenses;
CREATE POLICY user_licenses_update_policy ON licenses
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Only admins can delete licenses
DROP POLICY IF EXISTS user_licenses_delete_policy ON licenses;
CREATE POLICY user_licenses_delete_policy ON licenses
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- 7. Create Row-Level Security Policies for CONTRACTS (Admin-only)

-- Policy: Only admins can view contracts
DROP POLICY IF EXISTS admin_contracts_select_policy ON contracts;
CREATE POLICY admin_contracts_select_policy ON contracts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Only admins can create contracts
DROP POLICY IF EXISTS admin_contracts_insert_policy ON contracts;
CREATE POLICY admin_contracts_insert_policy ON contracts
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Only admins can update contracts
DROP POLICY IF EXISTS admin_contracts_update_policy ON contracts;
CREATE POLICY admin_contracts_update_policy ON contracts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Only admins can delete contracts
DROP POLICY IF EXISTS admin_contracts_delete_policy ON contracts;
CREATE POLICY admin_contracts_delete_policy ON contracts
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- 8. Migration: Link existing assets to admin user (backward compatibility)
DO $$
DECLARE
    admin_user_id INTEGER;
BEGIN
    -- Get first admin user
    SELECT id INTO admin_user_id FROM auth_users WHERE role = 'admin' LIMIT 1;
    
    -- If admin exists, assign unowned assets to admin
    IF admin_user_id IS NOT NULL THEN
        UPDATE assets SET user_id = admin_user_id WHERE user_id IS NULL;
        UPDATE licenses SET user_id = admin_user_id WHERE user_id IS NULL;
        UPDATE contracts SET user_id = admin_user_id WHERE user_id IS NULL;
    END IF;
END $$;

-- 9. Add helpful comments
COMMENT ON COLUMN assets.user_id IS 'Owner of this asset. NULL = unassigned. Admins see all, users see only theirs.';
COMMENT ON COLUMN licenses.user_id IS 'License assigned to this user. NULL = unassigned. Admins see all, users see only theirs.';
COMMENT ON COLUMN contracts.user_id IS 'User who manages this contract. Admin-only access.';

-- 10. Update the users table RLS to make it admin-only for full access
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own user record, admins see all
DROP POLICY IF EXISTS users_select_policy ON users;
CREATE POLICY users_select_policy ON users
    FOR SELECT
    USING (
        id = current_setting('app.current_user_id', true)::integer
        OR 
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Only admins can create users
DROP POLICY IF EXISTS users_insert_policy ON users;
CREATE POLICY users_insert_policy ON users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Only admins can update users
DROP POLICY IF EXISTS users_update_policy ON users;
CREATE POLICY users_update_policy ON users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

-- Policy: Only admins can delete users
DROP POLICY IF EXISTS users_delete_policy ON users;
CREATE POLICY users_delete_policy ON users
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM auth_users 
            WHERE id = current_setting('app.current_user_id', true)::integer 
            AND role = 'admin'
        )
    );

COMMENT ON TABLE assets IS 'IT assets with user ownership and Row-Level Security';
COMMENT ON TABLE licenses IS 'Software licenses with user assignment and Row-Level Security';
COMMENT ON TABLE contracts IS 'Vendor contracts (Admin-only access)';
COMMENT ON TABLE users IS 'User directory with RLS (users see self, admins see all)';
