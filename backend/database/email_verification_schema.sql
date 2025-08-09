-- Email verification tables for Fashion Color Wheel backend
-- Run these SQL commands to add email verification functionality

-- Add email verification columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP NULL;

-- Create email_verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id) -- One active verification per user
);

-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id) -- One active reset per user
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);

-- Create cleanup function to remove expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    -- Remove expired email verifications
    DELETE FROM email_verifications 
    WHERE expires_at < NOW() AND verified_at IS NULL;
    
    -- Remove expired password resets
    DELETE FROM password_resets 
    WHERE expires_at < NOW() AND used_at IS NULL;
    
    -- Remove used password resets older than 7 days
    DELETE FROM password_resets 
    WHERE used_at IS NOT NULL AND used_at < NOW() - INTERVAL '7 days';
    
    -- Remove verified email verifications older than 30 days
    DELETE FROM email_verifications 
    WHERE verified_at IS NOT NULL AND verified_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (if using PostgreSQL with pg_cron extension)
-- SELECT cron.schedule('cleanup-expired-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens();');

COMMENT ON TABLE email_verifications IS 'Stores email verification tokens for new user registrations';
COMMENT ON TABLE password_resets IS 'Stores password reset tokens for user password recovery';
COMMENT ON FUNCTION cleanup_expired_tokens() IS 'Removes expired and old verification/reset tokens';
