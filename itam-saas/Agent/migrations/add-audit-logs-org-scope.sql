-- Add organization scoping to audit_logs and tighten RLS

-- 1) Add organization_id column if missing
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS organization_id INTEGER;

-- 2) Backfill organization_id from auth_users when possible
UPDATE audit_logs al
SET organization_id = au.organization_id
FROM auth_users au
WHERE al.organization_id IS NULL
  AND al.user_id = au.id;

-- 3) Index for org-scoped lookups
CREATE INDEX IF NOT EXISTS idx_audit_org_id ON audit_logs(organization_id);

-- 4) Enable RLS (idempotent) and replace policies with org-scoped ones
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_select_policy') THEN
    EXECUTE 'DROP POLICY audit_logs_select_policy ON audit_logs';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_insert_policy') THEN
    EXECUTE 'DROP POLICY audit_logs_insert_policy ON audit_logs';
  END IF;
END $$;

-- Select policy: only rows in the caller's org are visible
DO $$
BEGIN
  CREATE POLICY audit_logs_select_policy ON audit_logs
    FOR SELECT
    USING (
      organization_id IS NOT NULL
      AND organization_id = (
        SELECT organization_id FROM auth_users WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
      )
    );
END $$;

-- Insert policy: only allow writes tagged with caller's org (or null when caller has no org)
DO $$
BEGIN
  CREATE POLICY audit_logs_insert_policy ON audit_logs
    FOR INSERT
    WITH CHECK (
      (
        organization_id IS NOT NULL
        AND organization_id = (
          SELECT organization_id FROM auth_users WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
        )
      )
      OR (
        organization_id IS NULL
        AND (
          SELECT organization_id FROM auth_users WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
        ) IS NULL
      )
    );
END $$;
