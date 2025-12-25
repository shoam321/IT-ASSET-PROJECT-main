-- ============================================================
-- FORBIDDEN APP DETECTION SYSTEM - DATABASE SCHEMA
-- ============================================================
-- Purpose: Track forbidden applications and security violations
-- Created: 2025-12-25
-- ============================================================

-- Table 1: Forbidden Apps (Admin-managed list)
CREATE TABLE IF NOT EXISTS forbidden_apps (
    id SERIAL PRIMARY KEY,
    process_name TEXT UNIQUE NOT NULL, -- e.g., "poker.exe", "torrent.exe"
    description TEXT, -- Optional: Why it's forbidden
    severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES auth_users(id), -- Which admin added it
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: Security Alerts (Violation records)
CREATE TABLE IF NOT EXISTS security_alerts (
    id SERIAL PRIMARY KEY,
    device_id TEXT NOT NULL, -- Which device detected the violation
    app_detected TEXT NOT NULL, -- Process name that was detected
    severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    process_id INTEGER, -- PID of the detected process
    user_id INTEGER REFERENCES auth_users(id), -- Which user owns the device
    status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Acknowledged', 'Resolved', 'False Positive')),
    resolved_at TIMESTAMPTZ,
    resolved_by INTEGER REFERENCES auth_users(id),
    notes TEXT, -- Admin notes about the incident
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_forbidden_apps_process_name ON forbidden_apps(process_name);
CREATE INDEX IF NOT EXISTS idx_security_alerts_device_id ON security_alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);

-- Trigger Function: Real-time Notification on New Alert
CREATE OR REPLACE FUNCTION notify_new_security_alert() 
RETURNS trigger AS $$
BEGIN
  -- Send PostgreSQL NOTIFY with the full alert as JSON
  PERFORM pg_notify(
    'new_security_alert', 
    json_build_object(
      'id', NEW.id,
      'device_id', NEW.device_id,
      'app_detected', NEW.app_detected,
      'severity', NEW.severity,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Fire on every INSERT into security_alerts
DROP TRIGGER IF EXISTS security_alert_trigger ON security_alerts;
CREATE TRIGGER security_alert_trigger 
  AFTER INSERT ON security_alerts
  FOR EACH ROW 
  EXECUTE FUNCTION notify_new_security_alert();

-- View: Recent Alerts with Device Info (for dashboard)
CREATE OR REPLACE VIEW recent_alerts AS
SELECT 
  sa.id,
  sa.device_id,
  sa.app_detected,
  sa.severity,
  sa.status,
  sa.created_at,
  d.hostname,
  d.os_name,
  au.username as device_owner
FROM security_alerts sa
LEFT JOIN devices d ON sa.device_id = d.device_id
LEFT JOIN auth_users au ON sa.user_id = au.id
ORDER BY sa.created_at DESC
LIMIT 100;

-- View: Alert Statistics (for dashboard summary)
CREATE OR REPLACE VIEW alert_statistics AS
SELECT 
  COUNT(*) as total_alerts,
  COUNT(CASE WHEN status = 'New' THEN 1 END) as new_alerts,
  COUNT(CASE WHEN severity = 'Critical' THEN 1 END) as critical_alerts,
  COUNT(CASE WHEN severity = 'High' THEN 1 END) as high_alerts,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as alerts_24h,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as alerts_7d
FROM security_alerts;

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_forbidden_apps_updated_at ON forbidden_apps;
CREATE TRIGGER update_forbidden_apps_updated_at
    BEFORE UPDATE ON forbidden_apps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert Default Forbidden Apps (Common security risks)
INSERT INTO forbidden_apps (process_name, description, severity) VALUES
  ('mimikatz.exe', 'Password dumping tool - Critical security risk', 'Critical'),
  ('nmap.exe', 'Network scanning tool - Unauthorized network reconnaissance', 'High'),
  ('wireshark.exe', 'Packet analyzer - Potential data interception', 'High'),
  ('torrent.exe', 'BitTorrent client - Policy violation', 'Medium'),
  ('utorrent.exe', 'BitTorrent client - Policy violation', 'Medium'),
  ('poker.exe', 'Gambling software - Workplace policy violation', 'Low'),
  ('steam.exe', 'Gaming platform - Productivity concern', 'Low')
ON CONFLICT (process_name) DO NOTHING;

-- Grant permissions (adjust based on your auth setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON forbidden_apps TO your_api_user;
-- GRANT SELECT, INSERT, UPDATE ON security_alerts TO your_api_user;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Tables Created:
--   - forbidden_apps (admin management)
--   - security_alerts (violation records)
-- 
-- Features Enabled:
--   - Real-time notifications via PostgreSQL NOTIFY
--   - Performance indexes on critical columns
--   - Views for dashboard analytics
--   - Auto-populated default forbidden apps
-- ============================================================
