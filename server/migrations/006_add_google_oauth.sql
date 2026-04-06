-- Allow OAuth users who don't have a password
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Google OAuth identifier
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Track how the account was created
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local';

-- Index for Google login lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
