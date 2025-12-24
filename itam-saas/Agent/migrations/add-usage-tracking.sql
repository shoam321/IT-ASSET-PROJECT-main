-- Migration: Add Usage Tracking Tables
-- Description: Adds tables for device usage monitoring, app tracking, and device status

-- Devices Table - Track all monitored devices
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  hostname VARCHAR(255),
  os_name VARCHAR(100),
  os_version VARCHAR(100),
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device Usage Table - Track application usage per device
CREATE TABLE IF NOT EXISTS device_usage (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  app_name VARCHAR(255) NOT NULL,
  window_title VARCHAR(500),
  duration INTEGER DEFAULT 0, -- Duration in seconds
  timestamp BIGINT NOT NULL, -- Unix timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Installed Apps Table - Track installed applications on each device
CREATE TABLE IF NOT EXISTS installed_apps (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  app_name VARCHAR(255) NOT NULL,
  app_version VARCHAR(100),
  install_date DATE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, app_name),
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Device Heartbeats - Track device connectivity
CREATE TABLE IF NOT EXISTS device_heartbeats (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_device_usage_device_id ON device_usage(device_id);
CREATE INDEX IF NOT EXISTS idx_device_usage_timestamp ON device_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_device_usage_app_name ON device_usage(app_name);
CREATE INDEX IF NOT EXISTS idx_installed_apps_device_id ON installed_apps(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device_id ON device_heartbeats(device_id);

-- Create views for common queries
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

-- Create function to update device last_seen
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE devices 
  SET last_seen = CURRENT_TIMESTAMP 
  WHERE device_id = NEW.device_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update last_seen on heartbeat
CREATE TRIGGER trigger_update_device_last_seen
AFTER INSERT ON device_heartbeats
FOR EACH ROW
EXECUTE FUNCTION update_device_last_seen();

COMMENT ON TABLE devices IS 'Stores information about all monitored devices';
COMMENT ON TABLE device_usage IS 'Tracks application usage history for each device';
COMMENT ON TABLE installed_apps IS 'Lists all installed applications on each device';
COMMENT ON TABLE device_heartbeats IS 'Records periodic heartbeat signals from devices';
