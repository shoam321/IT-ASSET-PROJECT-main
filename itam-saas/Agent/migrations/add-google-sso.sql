-- Add Google SSO support to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';

-- Create index for faster Google ID lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Update existing users to have 'local' auth provider
UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL;
