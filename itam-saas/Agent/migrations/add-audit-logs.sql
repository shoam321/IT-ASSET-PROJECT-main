-- Audit Trail Migration
-- Tracks all changes to assets, licenses, users, and contracts


-- Drop and re-add the constraint to ensure it is correct and idempotent
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'audit_logs' AND constraint_name = 'audit_logs_action_check'
  ) THEN
    EXECUTE 'ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_action_check';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  user_id INTEGER,
  username VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT
);


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'audit_logs' AND constraint_name = 'audit_logs_action_check'
  ) THEN
    EXECUTE 'ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (''LOGIN'', ''LOGOUT'', ''CREATE'', ''UPDATE'', ''DELETE''))';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record_id ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);

-- Enable Row-Level Security for multi-tenancy
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see audit logs for their own data
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_select_policy'
  ) THEN
    CREATE POLICY audit_logs_select_policy ON audit_logs
      FOR SELECT
      USING (user_id = current_setting('app.current_user_id', TRUE)::INTEGER);
  END IF;
END $$;

-- Policy: System can insert audit logs
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_insert_policy'
  ) THEN
    CREATE POLICY audit_logs_insert_policy ON audit_logs
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE audit_logs IS 'Tracks all CRUD operations across the system for compliance and security';
COMMENT ON COLUMN audit_logs.old_data IS 'JSON snapshot of record before change (NULL for CREATE)';
COMMENT ON COLUMN audit_logs.new_data IS 'JSON snapshot of record after change (NULL for DELETE)';
