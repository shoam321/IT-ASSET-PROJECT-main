-- Fix for organizations table RLS
-- Adds missing INSERT policy to allow organization creation via withSystemContext()
-- Without this INSERT policy, all inserts are blocked (PostgreSQL default-deny behavior)

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'organizations' AND policyname = 'organizations_insert_policy'
  ) THEN
    CREATE POLICY organizations_insert_policy ON organizations
      FOR INSERT
      WITH CHECK (current_setting('app.system', TRUE) = '1');
    
    RAISE NOTICE 'Created organizations_insert_policy to allow system context inserts';
  ELSE
    RAISE NOTICE 'organizations_insert_policy already exists';
  END IF;
END $$;
