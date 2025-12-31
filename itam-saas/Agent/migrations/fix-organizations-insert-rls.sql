-- Fix: Add missing INSERT policies for organizations table
-- When RLS is enabled without INSERT policies, all inserts are blocked.
-- This adds an INSERT policy that allows system context (app.system = '1').
-- The app.system flag is set by withSystemContext() in queries.js when creating organizations.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'organizations' AND policyname = 'organizations_system_insert_policy'
  ) THEN
    CREATE POLICY organizations_system_insert_policy ON organizations
      FOR INSERT
      WITH CHECK (
        current_setting('app.system', true) = '1'
      );
  END IF;
END $$;
