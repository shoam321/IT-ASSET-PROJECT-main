-- Migration: Tighten Assets/Licenses RLS
-- Purpose: Prevent non-admin users from viewing or modifying unassigned (user_id IS NULL) rows.
-- Rationale: Previous policies allowed user_id IS NULL which can expose all assets/licenses if they are unassigned.
-- Date: December 28, 2025

-- ASSETS
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
    )
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

-- Delete stays admin-only (keep existing name/behavior)
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

-- LICENSES
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

-- Keep licenses admin-only for write (as originally intended)
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
    )
    WITH CHECK (
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
