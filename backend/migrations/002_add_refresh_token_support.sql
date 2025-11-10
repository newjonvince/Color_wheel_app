-- Migration: Add refresh token support to user_sessions table
-- This adds columns needed for automatic token refresh functionality

-- Add refresh token columns
ALTER TABLE user_sessions 
ADD COLUMN refresh_jti VARCHAR(36) NULL,
ADD COLUMN refresh_expires_at TIMESTAMP NULL,
ADD COLUMN refresh_count INT DEFAULT 0,
ADD INDEX idx_refresh_jti (refresh_jti),
ADD INDEX idx_refresh_expires (refresh_expires_at);

-- Update existing sessions to have refresh_count = 0 if NULL
UPDATE user_sessions SET refresh_count = 0 WHERE refresh_count IS NULL;
