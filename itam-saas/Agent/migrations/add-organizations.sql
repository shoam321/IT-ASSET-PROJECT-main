-- Organizations and Multi-Org Support
-- Enables multiple companies to use the platform (true SaaS multi-tenancy)

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add organization_id to auth_users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_users' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE auth_users ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
  END IF;
END $$;

-- Add org_role to auth_users (owner, admin, member)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auth_users' AND column_name = 'org_role'
  ) THEN
    ALTER TABLE auth_users ADD COLUMN org_role VARCHAR(50) DEFAULT 'member';
  END IF;
END $$;

-- Create organization invitations table
CREATE TABLE IF NOT EXISTS organization_invitations (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  invited_by INTEGER REFERENCES auth_users(id),
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, email, status)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auth_users_organization_id ON auth_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);

-- Enable RLS on organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'organizations' AND policyname = 'organizations_select_policy'
  ) THEN
    CREATE POLICY organizations_select_policy ON organizations
      FOR SELECT
      USING (
        id IN (
          SELECT organization_id FROM auth_users 
          WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
        )
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'organizations' AND policyname = 'organizations_update_policy'
  ) THEN
    CREATE POLICY organizations_update_policy ON organizations
      FOR UPDATE
      USING (
        id IN (
          SELECT organization_id FROM auth_users 
          WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
          AND org_role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

-- INSERT policy for organizations (allows system context to create orgs)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'organizations' AND policyname = 'organizations_insert_policy'
  ) THEN
    CREATE POLICY organizations_insert_policy ON organizations
      FOR INSERT
      WITH CHECK (current_setting('app.system', TRUE) = '1');
  END IF;
END $$;

-- RLS Policies for organization_invitations
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'organization_invitations' AND policyname = 'org_invitations_select_policy'
  ) THEN
    CREATE POLICY org_invitations_select_policy ON organization_invitations
      FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM auth_users 
          WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
          AND org_role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'organization_invitations' AND policyname = 'org_invitations_insert_policy'
  ) THEN
    CREATE POLICY org_invitations_insert_policy ON organization_invitations
      FOR INSERT
      WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM auth_users 
          WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
          AND org_role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'organization_invitations' AND policyname = 'org_invitations_delete_policy'
  ) THEN
    CREATE POLICY org_invitations_delete_policy ON organization_invitations
      FOR DELETE
      USING (
        organization_id IN (
          SELECT organization_id FROM auth_users 
          WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
          AND org_role IN ('owner', 'admin')
        )
      );
  END IF;
END $$;

COMMENT ON TABLE organizations IS 'Organizations/companies using the platform (multi-tenant SaaS)';
COMMENT ON TABLE organization_invitations IS 'Pending invitations to join an organization';
