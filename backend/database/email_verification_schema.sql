-- Email verification tables for Fashion Color Wheel backend
-- Run these SQL commands to add email verification functionality

-- Add email verification columns to users table
ALTER TABLE users 
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN email_verified_at TIMESTAMP NULL;

-- Create email_verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_verification (user_id), -- One active verification per user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create password_resets table
CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_reset (user_id), -- One active reset per user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_email_verifications_token ON email_verifications(token);
CREATE INDEX idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX idx_email_verifications_expires_at ON email_verifications(expires_at);

CREATE INDEX idx_password_resets_token ON password_resets(token);
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX idx_password_resets_expires_at ON password_resets(expires_at);

-- Create cleanup procedure to remove expired tokens
DELIMITER //
CREATE PROCEDURE cleanup_expired_tokens()
BEGIN
    -- Remove expired email verifications
    DELETE FROM email_verifications 
    WHERE expires_at < NOW() AND verified_at IS NULL;
    
    -- Remove expired password resets
    DELETE FROM password_resets 
    WHERE expires_at < NOW() AND used_at IS NULL;
    
    -- Remove used password resets older than 7 days
    DELETE FROM password_resets 
    WHERE used_at IS NOT NULL AND used_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
    
    -- Remove verified email verifications older than 30 days
    DELETE FROM email_verifications 
    WHERE verified_at IS NOT NULL AND verified_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END //
DELIMITER ;

-- Create an event to run cleanup daily at 2 AM (MySQL equivalent of cron)
-- SET GLOBAL event_scheduler = ON;
-- CREATE EVENT IF NOT EXISTS cleanup_expired_tokens_event
-- ON SCHEDULE EVERY 1 DAY STARTS '2023-01-01 02:00:00'
-- DO CALL cleanup_expired_tokens();

-- Table comments (MySQL style)
ALTER TABLE email_verifications COMMENT = 'Stores email verification tokens for new user registrations';
ALTER TABLE password_resets COMMENT = 'Stores password reset tokens for user password recovery';
