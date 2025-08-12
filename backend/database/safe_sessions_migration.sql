-- Safe migration for user_sessions table with existing data
-- This handles the JTI constraint issue by migrating existing sessions properly

-- Step 1: Add columns without NOT NULL constraint first
ALTER TABLE user_sessions 
ADD COLUMN jti VARCHAR(36) NULL COMMENT 'JWT ID for token identification',
ADD COLUMN revoked_at TIMESTAMP NULL COMMENT 'When session was revoked (NULL = active)',
ADD COLUMN ip_address VARCHAR(45) COMMENT 'IP address when session was created',
ADD COLUMN user_agent TEXT COMMENT 'User agent when session was created';

-- Step 2: Update existing sessions with unique JTI values
-- This generates a UUID for each existing session
UPDATE user_sessions 
SET jti = UUID() 
WHERE jti IS NULL;

-- Step 3: Now add the NOT NULL and UNIQUE constraints
ALTER TABLE user_sessions 
MODIFY COLUMN jti VARCHAR(36) NOT NULL;

ALTER TABLE user_sessions 
ADD CONSTRAINT uk_user_sessions_jti UNIQUE (jti);

-- Step 4: Create indexes for performance
CREATE INDEX idx_user_sessions_jti ON user_sessions(jti);
CREATE INDEX idx_user_sessions_auth ON user_sessions(jti, user_id, expires_at, revoked_at);
CREATE INDEX idx_user_sessions_cleanup ON user_sessions(expires_at, revoked_at);

-- Step 5: Optional - Clean up old sessions that don't have proper structure
-- DELETE FROM user_sessions WHERE expires_at < NOW();

-- Verification query to check the migration worked
-- SELECT COUNT(*) as total_sessions, COUNT(DISTINCT jti) as unique_jtis FROM user_sessions;
