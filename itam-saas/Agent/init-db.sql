-- IT Asset Management Database Schema

-- Authentication Users Table
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to existing assets table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='assets' AND column_name='cost') THEN
    ALTER TABLE assets ADD COLUMN cost DECIMAL(10, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='assets' AND column_name='discovered') THEN
    ALTER TABLE assets ADD COLUMN discovered BOOLEAN DEFAULT false;
  END IF;
END $$;

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  department VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(255),
  status VARCHAR(50) DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Rename user_name to username if needed for legacy DBs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='user_name') THEN
    EXECUTE 'ALTER TABLE users RENAME COLUMN user_name TO username';
  END IF;
END $$;

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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_username ON auth_users(username);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_asset_tag ON assets(asset_tag);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
