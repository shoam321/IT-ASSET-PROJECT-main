-- =======================================================================
-- EMERGENCY DATABASE RESTORE SCRIPT
-- Run this in Railway PostgreSQL console to restore all missing tables
-- Generated: 2026-01-02
-- =======================================================================

-- =====================
-- 1. BASE TABLES
-- =====================

-- Authentication Users Table (must be first - other tables reference it)
CREATE TABLE IF NOT EXISTS auth_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organizations table (multi-tenancy foundation)
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
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Add organization columns to auth_users
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'google_id') THEN
    ALTER TABLE auth_users ADD COLUMN google_id VARCHAR(255);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_auth_users_organization_id ON auth_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_username ON auth_users(username);

-- =====================
-- 2. LOCATION & CATEGORY TABLES
-- =====================

-- Locations table
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

-- Employees table (ghost users / assignees)
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

-- Asset categories table
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

-- =====================
-- 3. CORE ASSET TABLES
-- =====================

-- Assets Table
CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  asset_tag VARCHAR(255) UNIQUE NOT NULL,
  asset_type VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  model VARCHAR(255),
  serial_number VARCHAR(255),
  assigned_user_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'In Use',
  cost DECIMAL(10, 2) DEFAULT 0,
  discovered BOOLEAN DEFAULT false,
  user_id INTEGER REFERENCES auth_users(id),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  location_id INTEGER,
  category_id INTEGER,
  location VARCHAR(255),
  assigned_to INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to existing assets table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='cost') THEN
    ALTER TABLE assets ADD COLUMN cost DECIMAL(10, 2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='discovered') THEN
    ALTER TABLE assets ADD COLUMN discovered BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='user_id') THEN
    ALTER TABLE assets ADD COLUMN user_id INTEGER REFERENCES auth_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='organization_id') THEN
    ALTER TABLE assets ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='location_id') THEN
    ALTER TABLE assets ADD COLUMN location_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='category_id') THEN
    ALTER TABLE assets ADD COLUMN category_id INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='location') THEN
    ALTER TABLE assets ADD COLUMN location VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assets' AND column_name='assigned_to') THEN
    ALTER TABLE assets ADD COLUMN assigned_to INTEGER;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_asset_tag ON assets(asset_tag);
CREATE INDEX IF NOT EXISTS idx_assets_org_id ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);

-- Licenses Table
CREATE TABLE IF NOT EXISTS licenses (
  id SERIAL PRIMARY KEY,
  license_name VARCHAR(255) NOT NULL,
  license_type VARCHAR(255),
  license_key TEXT,
  software_name VARCHAR(255),
  vendor VARCHAR(255),
  expiration_date DATE,
  quantity INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'Active',
  cost DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  user_id INTEGER REFERENCES auth_users(id),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='user_id') THEN
    ALTER TABLE licenses ADD COLUMN user_id INTEGER REFERENCES auth_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='organization_id') THEN
    ALTER TABLE licenses ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_org_id ON licenses(organization_id);

-- Users Table (legacy, for backward compatibility)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  department VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Active',
  notes TEXT,
  user_id INTEGER REFERENCES auth_users(id),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='user_id') THEN
    ALTER TABLE users ADD COLUMN user_id INTEGER REFERENCES auth_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='organization_id') THEN
    ALTER TABLE users ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(organization_id);

-- Contracts Table
CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  contract_name VARCHAR(255) NOT NULL,
  vendor VARCHAR(255),
  contract_type VARCHAR(255),
  start_date DATE,
  end_date DATE,
  value DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Active',
  renewal_terms TEXT,
  notes TEXT,
  user_id INTEGER REFERENCES auth_users(id),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='user_id') THEN
    ALTER TABLE contracts ADD COLUMN user_id INTEGER REFERENCES auth_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='organization_id') THEN
    ALTER TABLE contracts ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_org_id ON contracts(organization_id);

-- =====================
-- 4. DEVICE TRACKING TABLES
-- =====================

-- Devices Table
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  hostname VARCHAR(255),
  os_name VARCHAR(100),
  os_version VARCHAR(100),
  user_id INTEGER REFERENCES auth_users(id),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='user_id') THEN
    ALTER TABLE devices ADD COLUMN user_id INTEGER REFERENCES auth_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='organization_id') THEN
    ALTER TABLE devices ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_org_id ON devices(organization_id);

-- Device Usage Table
CREATE TABLE IF NOT EXISTS device_usage (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  app_name VARCHAR(255) NOT NULL,
  window_title VARCHAR(500),
  duration INTEGER DEFAULT 0,
  timestamp BIGINT NOT NULL,
  user_id INTEGER REFERENCES auth_users(id),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='device_usage' AND column_name='user_id') THEN
    ALTER TABLE device_usage ADD COLUMN user_id INTEGER REFERENCES auth_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='device_usage' AND column_name='organization_id') THEN
    ALTER TABLE device_usage ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_device_usage_device_id ON device_usage(device_id);
CREATE INDEX IF NOT EXISTS idx_device_usage_timestamp ON device_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_device_usage_app_name ON device_usage(app_name);
CREATE INDEX IF NOT EXISTS idx_device_usage_user_id ON device_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_device_usage_org_id ON device_usage(organization_id);

-- Installed Apps Table
CREATE TABLE IF NOT EXISTS installed_apps (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  app_name VARCHAR(255) NOT NULL,
  app_version VARCHAR(100),
  install_date DATE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER REFERENCES auth_users(id),
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(device_id, app_name),
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installed_apps' AND column_name='user_id') THEN
    ALTER TABLE installed_apps ADD COLUMN user_id INTEGER REFERENCES auth_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installed_apps' AND column_name='organization_id') THEN
    ALTER TABLE installed_apps ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_installed_apps_device_id ON installed_apps(device_id);
CREATE INDEX IF NOT EXISTS idx_installed_apps_user_id ON installed_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_installed_apps_org_id ON installed_apps(organization_id);

-- Device Heartbeats
CREATE TABLE IF NOT EXISTS device_heartbeats (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device_id ON device_heartbeats(device_id);

-- =====================
-- 5. RECEIPTS & DOCUMENTS
-- =====================

-- Digital Receipts Table
CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  description TEXT,
  uploaded_by INTEGER REFERENCES auth_users(id),
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_receipts_asset_id ON receipts(asset_id);
CREATE INDEX IF NOT EXISTS idx_receipts_upload_date ON receipts(upload_date);

-- =====================
-- 6. SECURITY & ALERTS
-- =====================

-- Forbidden Apps Table
CREATE TABLE IF NOT EXISTS forbidden_apps (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'other',
  severity VARCHAR(50) DEFAULT 'medium',
  is_global BOOLEAN DEFAULT FALSE,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forbidden_apps_name ON forbidden_apps(name);
CREATE INDEX IF NOT EXISTS idx_forbidden_apps_org ON forbidden_apps(organization_id);
CREATE INDEX IF NOT EXISTS idx_forbidden_apps_user ON forbidden_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_forbidden_apps_global ON forbidden_apps(is_global);

-- Security Alerts Table
CREATE TABLE IF NOT EXISTS security_alerts (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255),
  app_name VARCHAR(255) NOT NULL,
  alert_type VARCHAR(100) DEFAULT 'forbidden_app',
  severity VARCHAR(50) DEFAULT 'medium',
  status VARCHAR(50) DEFAULT 'new',
  details JSONB,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE,
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES auth_users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_device ON security_alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_org ON security_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at);

-- =====================
-- 7. CONSUMABLES & INVENTORY
-- =====================

-- Consumables Table
CREATE TABLE IF NOT EXISTS consumables (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'units',
  location VARCHAR(255),
  cost_per_unit DECIMAL(10, 2) DEFAULT 0,
  supplier VARCHAR(255),
  notes TEXT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES auth_users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consumables_org ON consumables(organization_id);
CREATE INDEX IF NOT EXISTS idx_consumables_user ON consumables(user_id);
CREATE INDEX IF NOT EXISTS idx_consumables_category ON consumables(category);

-- Consumable Transactions Table
CREATE TABLE IF NOT EXISTS consumable_transactions (
  id SERIAL PRIMARY KEY,
  consumable_id INTEGER NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  notes TEXT,
  performed_by INTEGER REFERENCES auth_users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consumable_transactions_consumable ON consumable_transactions(consumable_id);
CREATE INDEX IF NOT EXISTS idx_consumable_transactions_type ON consumable_transactions(transaction_type);

-- Low Stock Alerts Table
CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id SERIAL PRIMARY KEY,
  consumable_id INTEGER NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) DEFAULT 'low_stock',
  status VARCHAR(50) DEFAULT 'active',
  acknowledged_by INTEGER REFERENCES auth_users(id),
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_consumable ON low_stock_alerts(consumable_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_status ON low_stock_alerts(status);

-- =====================
-- 8. GRAFANA INTEGRATION
-- =====================

-- Grafana dashboards table
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

-- =====================
-- 9. SESSION MANAGEMENT
-- =====================

-- Session table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- =====================
-- 10. VIEWS & FUNCTIONS
-- =====================

-- Create view for device app summary
CREATE OR REPLACE VIEW device_app_summary AS
SELECT 
  d.device_id,
  d.hostname,
  du.app_name,
  COUNT(*) as usage_count,
  SUM(du.duration) as total_duration,
  MAX(du.timestamp) as last_used
FROM devices d
LEFT JOIN device_usage du ON d.device_id = du.device_id
GROUP BY d.device_id, d.hostname, du.app_name;

-- Function to update device last_seen
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE devices 
  SET last_seen = CURRENT_TIMESTAMP 
  WHERE device_id = NEW.device_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-update last_seen on heartbeat
DROP TRIGGER IF EXISTS trigger_update_device_last_seen ON device_heartbeats;
CREATE TRIGGER trigger_update_device_last_seen
AFTER INSERT ON device_heartbeats
FOR EACH ROW
EXECUTE FUNCTION update_device_last_seen();

-- =====================
-- 11. DEFAULT DATA (if needed)
-- =====================

-- Insert default organization if none exists
INSERT INTO organizations (name, plan, settings)
SELECT 'Default Organization', 'free', '{}'
WHERE NOT EXISTS (SELECT 1 FROM organizations LIMIT 1);

-- =====================
-- VERIFICATION
-- =====================
SELECT 'Database restoration complete!' AS status;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
