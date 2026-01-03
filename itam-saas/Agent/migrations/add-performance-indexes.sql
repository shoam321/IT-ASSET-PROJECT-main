-- Performance optimization indexes
-- Based on ACTUAL schema verified 2026-01-03

-- Assets (has: organization_id, status, asset_tag, assigned_user_name, created_at)
CREATE INDEX IF NOT EXISTS idx_assets_org_id ON assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_asset_tag ON assets(asset_tag);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_org_status ON assets(organization_id, status);

-- Licenses (has: organization_id, status, expiration_date, vendor)
CREATE INDEX IF NOT EXISTS idx_licenses_org_id ON licenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expiration ON licenses(expiration_date);
CREATE INDEX IF NOT EXISTS idx_licenses_vendor ON licenses(vendor);

-- Users (has: organization_id, email, status)
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Contracts (has: organization_id, status, end_date)
CREATE INDEX IF NOT EXISTS idx_contracts_org_id ON contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);

-- Device usage (has: device_id, user_id, timestamp)
CREATE INDEX IF NOT EXISTS idx_device_usage_timestamp ON device_usage(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_device_usage_device_user ON device_usage(device_id, user_id);

-- Forbidden apps (has: organization_id, user_id, name, severity)
CREATE INDEX IF NOT EXISTS idx_forbidden_apps_org_id ON forbidden_apps(organization_id);
CREATE INDEX IF NOT EXISTS idx_forbidden_apps_user ON forbidden_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_forbidden_apps_name ON forbidden_apps(name);

-- Security alerts (has: organization_id, alert_type, severity, status, created_at, device_id)
CREATE INDEX IF NOT EXISTS idx_security_alerts_org_id ON security_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON security_alerts(created_at DESC);

-- Consumables (has: organization_id only - NO status column)
CREATE INDEX IF NOT EXISTS idx_consumables_org_id ON consumables(organization_id);

-- Receipts (has: NO organization_id column - skip)

-- Auth users (has: email, google_id, organization_id)
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_google_id ON auth_users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_users_org_id ON auth_users(organization_id);

-- Devices (has: user_id, organization_id)
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_org_id ON devices(organization_id);

-- Audit logs (has: organization_id, created_at)
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ANALYZE;
