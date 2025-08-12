-- Enhanced user_sessions schema for JWT security improvements
-- This adds JTI support, revocation tracking, and proper indexing

-- Add new columns to existing user_sessions table
ALTER TABLE user_sessions 
ADD COLUMN jti VARCHAR(36) UNIQUE NOT NULL COMMENT 'JWT ID for token identification',
ADD COLUMN revoked_at TIMESTAMP NULL COMMENT 'When session was revoked (NULL = active)',
ADD COLUMN ip_address VARCHAR(45) COMMENT 'IP address when session was created',
ADD COLUMN user_agent TEXT COMMENT 'User agent when session was created';

-- Create index on jti for fast lookups (critical for performance)
CREATE INDEX idx_user_sessions_jti ON user_sessions(jti);

-- Create composite index for the auth query
CREATE INDEX idx_user_sessions_auth ON user_sessions(jti, user_id, expires_at, revoked_at);

-- Create index for cleanup queries
CREATE INDEX idx_user_sessions_cleanup ON user_sessions(expires_at, revoked_at);

-- Update existing sessions to have JTI (for migration)
-- Note: This would need to be handled carefully in production
-- UPDATE user_sessions SET jti = UUID() WHERE jti IS NULL;

-- Optional: Add constraint to ensure revoked sessions have revoked_at timestamp
-- ALTER TABLE user_sessions ADD CONSTRAINT chk_revoked_consistency 
-- CHECK (revoked_at IS NULL OR revoked_at <= NOW());

-- Sample query for session cleanup (expired and revoked sessions)
-- DELETE FROM user_sessions WHERE expires_at < NOW() OR revoked_at IS NOT NULL;
