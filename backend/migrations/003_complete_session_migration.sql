-- Complete migration for user_sessions table compatibility
-- This ensures all columns exist for both old and new auth systems

-- First, check if columns exist and add them if missing
-- Note: This uses IF NOT EXISTS syntax for MySQL 8.0+

-- Add JTI column if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'user_sessions' 
   AND COLUMN_NAME = 'jti') = 0,
  'ALTER TABLE user_sessions ADD COLUMN jti VARCHAR(36) NULL',
  'SELECT "jti column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add revoked_at column if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'user_sessions' 
   AND COLUMN_NAME = 'revoked_at') = 0,
  'ALTER TABLE user_sessions ADD COLUMN revoked_at TIMESTAMP NULL',
  'SELECT "revoked_at column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add ip_address column if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'user_sessions' 
   AND COLUMN_NAME = 'ip_address') = 0,
  'ALTER TABLE user_sessions ADD COLUMN ip_address VARCHAR(45) NULL',
  'SELECT "ip_address column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add user_agent column if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'user_sessions' 
   AND COLUMN_NAME = 'user_agent') = 0,
  'ALTER TABLE user_sessions ADD COLUMN user_agent TEXT NULL',
  'SELECT "user_agent column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add refresh_count column if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'user_sessions' 
   AND COLUMN_NAME = 'refresh_count') = 0,
  'ALTER TABLE user_sessions ADD COLUMN refresh_count INT DEFAULT 0',
  'SELECT "refresh_count column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add refresh_jti column if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'user_sessions' 
   AND COLUMN_NAME = 'refresh_jti') = 0,
  'ALTER TABLE user_sessions ADD COLUMN refresh_jti VARCHAR(36) NULL',
  'SELECT "refresh_jti column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add refresh_expires_at column if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'user_sessions' 
   AND COLUMN_NAME = 'refresh_expires_at') = 0,
  'ALTER TABLE user_sessions ADD COLUMN refresh_expires_at TIMESTAMP NULL',
  'SELECT "refresh_expires_at column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add updated_at column if it doesn't exist
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = DATABASE() 
   AND TABLE_NAME = 'user_sessions' 
   AND COLUMN_NAME = 'updated_at') = 0,
  'ALTER TABLE user_sessions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT "updated_at column already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create indexes if they don't exist
-- Note: MySQL will ignore if index already exists

-- Index for JTI lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions(jti);

-- Index for refresh JTI lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_jti ON user_sessions(refresh_jti);

-- Composite index for auth queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_auth ON user_sessions(jti, user_id, expires_at, revoked_at);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_cleanup ON user_sessions(expires_at, revoked_at);

-- Index for refresh expiration
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_expires ON user_sessions(refresh_expires_at);

-- Update existing sessions to have default values
UPDATE user_sessions 
SET refresh_count = 0 
WHERE refresh_count IS NULL;

-- Generate JTI for existing sessions that don't have one
UPDATE user_sessions 
SET jti = UUID() 
WHERE jti IS NULL;

-- Verification: Show table structure
SELECT 
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'user_sessions' 
AND TABLE_SCHEMA = DATABASE()
ORDER BY ORDINAL_POSITION;
