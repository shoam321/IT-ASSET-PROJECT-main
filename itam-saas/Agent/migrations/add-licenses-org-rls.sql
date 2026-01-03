-- Add organization scoping and RLS to licenses

-- 1) Add organization_id column if missing
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS organization_id INTEGER;

-- 2) Backfill organization_id from auth_users when possible via created_by metadata (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'licenses' AND column_name = 'created_by'
  ) THEN
    UPDATE licenses l
      SET organization_id = au.organization_id
      FROM auth_users au
      WHERE l.organization_id IS NULL
        AND l.created_by = au.id;
  END IF;
END $$;

-- 3) Index for org-scoped lookups
CREATE INDEX IF NOT EXISTS idx_licenses_org_id ON licenses(organization_id);

-- 4) Enable RLS and enforce org isolation
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'licenses' AND policyname = 'licenses_select_policy') THEN
    EXECUTE 'DROP POLICY licenses_select_policy ON licenses';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'licenses' AND policyname = 'licenses_mod_policy') THEN
    EXECUTE 'DROP POLICY licenses_mod_policy ON licenses';
  END IF;
END $$;

-- Select policy: only rows for caller's org
DO $$
BEGIN
  CREATE POLICY licenses_select_policy ON licenses
    FOR SELECT
    USING (
      organization_id IS NOT NULL
      AND organization_id = (
        SELECT organization_id FROM auth_users WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
      )
    );
END $$;

-- Insert/Update/Delete policy: must match caller org (or null-org callers stay blocked)
DO $$
BEGIN
  CREATE POLICY licenses_mod_policy ON licenses
    FOR ALL
    USING (
      organization_id IS NOT NULL
      AND organization_id = (
        SELECT organization_id FROM auth_users WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
      )
    )
    WITH CHECK (
      organization_id IS NOT NULL
      AND organization_id = (
        SELECT organization_id FROM auth_users WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
      )
    );
END $$;
