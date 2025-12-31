-- CRITICAL FIX: Update organizations INSERT RLS policy 
-- Issue: set_config with 'false' parameter doesn't work reliably in RLS context
-- Solution: Use SET LOCAL in transaction instead, and explicitly cast setting to TEXT

-- Drop the old problematic policy
DROP POLICY IF EXISTS organizations_insert_policy ON organizations;

-- Create new INSERT policy with explicit TEXT cast for reliable comparison
CREATE POLICY organizations_insert_policy ON organizations
  FOR INSERT
  WITH CHECK (
    -- This checks if app.system was set to '1' via SET LOCAL in the transaction
    current_setting('app.system', TRUE)::TEXT = '1'
  );

-- Verify policy creation
\echo 'Policy created successfully. Checking:'
SELECT tablename, policyname, with_check 
FROM pg_policies 
WHERE tablename = 'organizations' AND policyname = 'organizations_insert_policy';

-- Test: This query should succeed if system context is set
-- SELECT * FROM organizations WHERE current_setting('app.system', TRUE)::TEXT = '1' LIMIT 1;

