-- Simple migration: Clear existing sessions and add new schema
-- This is the safest approach for development/staging environments

-- Step 1: Clear all existing sessions (users will need to log in again)
DELETE FROM user_sessions;

-- Step 2: Add new columns with constraints
ALTER TABLE user_sessions 
ADD COLUMN jti VARCHAR(36) UNIQUE NOT NULL COMMENT 'JWT ID for token identification',
ADD COLUMN revoked_at TIMESTAMP NULL COMMENT 'When session was revoked (NULL = active)',
ADD COLUMN ip_address VARCHAR(45) COMMENT 'IP address when session was created',
ADD COLUMN user_agent TEXT COMMENT 'User agent when session was created';

-- Step 3: Create indexes for performance
CREATE INDEX idx_user_sessions_jti ON user_sessions(jti);
CREATE INDEX idx_user_sessions_auth ON user_sessions(jti, user_id, expires_at, revoked_at);
CREATE INDEX idx_user_sessions_cleanup ON user_sessions(expires_at, revoked_at);

-- Verification: Check table structure
-- DESCRIBE user_sessions;
