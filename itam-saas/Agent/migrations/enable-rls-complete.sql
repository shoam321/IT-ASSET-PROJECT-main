-- Enable RLS and Apply Tightened Policies
-- This migration:
-- 1. Enables Row-Level Security on assets and licenses tables
-- 2. Applies policies so users only see their own data (admins see all)

-- Enable RLS on assets table
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Enable RLS on licenses table  
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- ASSETS POLICIES
DROP POLICY IF EXISTS user_assets_select_policy ON assets;
CREATE POLICY user_assets_select_policy ON assets
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

DROP POLICY IF EXISTS user_assets_insert_policy ON assets;
CREATE POLICY user_assets_insert_policy ON assets
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND (
            EXISTS (
                SELECT 1 FROM auth_users
                WHERE id = current_setting('app.current_user_id', true)::integer
                AND role = 'admin'
            )
            OR user_id = current_setting('app.current_user_id', true)::integer
        )
    );

DROP POLICY IF EXISTS user_assets_update_policy ON assets;
CREATE POLICY user_assets_update_policy ON assets
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

DROP POLICY IF EXISTS user_assets_delete_policy ON assets;
CREATE POLICY user_assets_delete_policy ON assets
    FOR DELETE
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND EXISTS (
            SELECT 1 FROM auth_users
            WHERE id = current_setting('app.current_user_id', true)::integer
            AND role = 'admin'
        )
    );

-- LICENSES POLICIES
DROP POLICY IF EXISTS user_licenses_select_policy ON licenses;
CREATE POLICY user_licenses_select_policy ON licenses
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

DROP POLICY IF EXISTS user_licenses_insert_policy ON licenses;
CREATE POLICY user_licenses_insert_policy ON licenses
    FOR INSERT
    WITH CHECK (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND EXISTS (
            SELECT 1 FROM auth_users
            WHERE id = current_setting('app.current_user_id', true)::integer
            AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS user_licenses_update_policy ON licenses;
CREATE POLICY user_licenses_update_policy ON licenses
    FOR UPDATE
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND EXISTS (
            SELECT 1 FROM auth_users
            WHERE id = current_setting('app.current_user_id', true)::integer
            AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS user_licenses_delete_policy ON licenses;
CREATE POLICY user_licenses_delete_policy ON licenses
    FOR DELETE
    USING (
        current_setting('app.current_user_id', true) IS NOT NULL
        AND current_setting('app.current_user_id', true) != ''
        AND EXISTS (
            SELECT 1 FROM auth_users
            WHERE id = current_setting('app.current_user_id', true)::integer
            AND role = 'admin'
        )
    );
