-- =======================================================================
-- COMPLETE SCHEMA SETUP FOR IT ASSET MANAGEMENT SAAS
-- Run this script in Railway PostgreSQL console to create all required tables
-- =======================================================================

-- 1. Organizations table (multi-tenancy foundation)
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  billing_tier VARCHAR(50) DEFAULT 'regular',
  subscription_status VARCHAR(50),
  paypal_subscription_id VARCHAR(255),
  subscription_started_at TIMESTAMP,
  subscription_current_period_end TIMESTAMP,
  subscription_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain) WHERE domain IS NOT NULL;

-- Disable RLS on organizations (security handled at app level)
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- 2. Add organization columns to auth_users if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'organization_id') THEN
    ALTER TABLE auth_users ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'org_role') THEN
    ALTER TABLE auth_users ADD COLUMN org_role VARCHAR(50) DEFAULT 'member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'onboarding_completed') THEN
    ALTER TABLE auth_users ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_auth_users_organization_id ON auth_users(organization_id);

-- 3. Locations table
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_org_default ON locations(organization_id) WHERE is_default;

-- 4. Employees table (ghost users / assignees)
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  department VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_org_email ON employees(organization_id, email) WHERE email IS NOT NULL;

-- 5. Asset categories table
CREATE TABLE IF NOT EXISTS asset_categories (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  icon_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_asset_categories_org ON asset_categories(organization_id);

-- 6. Add organization columns to assets if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'location_id') THEN
    ALTER TABLE assets ADD COLUMN location_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'category_id') THEN
    ALTER TABLE assets ADD COLUMN category_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'location') THEN
    ALTER TABLE assets ADD COLUMN location VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'assigned_to') THEN
    ALTER TABLE assets ADD COLUMN assigned_to INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'organization_id') THEN
    ALTER TABLE assets ADD COLUMN organization_id INTEGER;
  END IF;
END$$;

-- Add foreign keys if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_assets_location_id') THEN
    ALTER TABLE assets ADD CONSTRAINT fk_assets_location_id FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_assets_category_id') THEN
    ALTER TABLE assets ADD CONSTRAINT fk_assets_category_id FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_assets_org_id') THEN
    ALTER TABLE assets ADD CONSTRAINT fk_assets_org_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_assets_org_id ON assets(organization_id);

-- 7. Grafana dashboards table
CREATE TABLE IF NOT EXISTS grafana_dashboards (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  embed_url TEXT NOT NULL,
  created_by INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_grafana_dashboards_org ON grafana_dashboards(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grafana_dashboards_org_name ON grafana_dashboards(organization_id, name);

-- 8. Backfill: attach existing assets to their owner's organization when possible
UPDATE assets a
   SET organization_id = u.organization_id
  FROM auth_users u
 WHERE a.organization_id IS NULL
   AND a.user_id = u.id
   AND u.organization_id IS NOT NULL;

-- =======================================================================
-- VERIFICATION QUERIES (run to confirm setup)
-- =======================================================================
SELECT 'Tables created:' AS status;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('organizations', 'locations', 'employees', 'asset_categories', 'grafana_dashboards', 'assets', 'auth_users')
ORDER BY table_name;

SELECT 'auth_users columns:' AS status;
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'auth_users' 
  AND column_name IN ('organization_id', 'org_role', 'onboarding_completed');

SELECT 'RLS status on organizations:' AS status;
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'organizations';
