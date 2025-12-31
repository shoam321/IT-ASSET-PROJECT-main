-- Onboarding foundation: locations, employees (ghost users), asset categories with icons, onboarding flag

ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Ensure org domains are unique to support ON CONFLICT (domain)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain) WHERE domain IS NOT NULL;

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

ALTER TABLE assets ADD COLUMN IF NOT EXISTS location_id INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category_id INTEGER;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assets_location_id') THEN
    ALTER TABLE assets ADD CONSTRAINT fk_assets_location_id FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assets_category_id') THEN
    ALTER TABLE assets ADD CONSTRAINT fk_assets_category_id FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE SET NULL;
  END IF;
END $$;
