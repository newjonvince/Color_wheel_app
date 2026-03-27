-- Fashion Color Wheel - Complete Database Schema
-- Run this manually in Railway MySQL console to create all tables

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  location VARCHAR(100),
  birthday_month VARCHAR(20),
  birthday_day INT,
  birthday_year INT,
  gender VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active TINYINT(1) DEFAULT 1,
  email_verified TINYINT(1) DEFAULT 0,
  email_verified_at TIMESTAMP NULL,
  UNIQUE KEY email (email),
  UNIQUE KEY username (username),
  INDEX idx_users_email (email),
  INDEX idx_users_username (username)
) ENGINE=InnoDB;

-- 2. User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id VARCHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  theme VARCHAR(20) DEFAULT 'light',
  notifications_enabled TINYINT(1) DEFAULT 1,
  privacy_level VARCHAR(20) DEFAULT 'public',
  language VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_preferences (user_id),
  INDEX idx_user_preferences_user_id (user_id)
) ENGINE=InnoDB;

-- 3. User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  session_token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  jti VARCHAR(36) NOT NULL,
  revoked_at TIMESTAMP NULL COMMENT 'When session was revoked (NULL = active)',
  ip_address VARCHAR(45) NULL COMMENT 'IP address when session was created',
  user_agent TEXT NULL COMMENT 'User agent when session was created',
  CONSTRAINT uk_user_sessions_jti UNIQUE (jti),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_user_sessions_auth (jti, user_id, expires_at, revoked_at),
  INDEX idx_user_sessions_cleanup (expires_at, revoked_at),
  INDEX idx_user_sessions_expires_at (expires_at),
  INDEX idx_user_sessions_jti (jti),
  INDEX idx_user_sessions_user_id (user_id)
) ENGINE=InnoDB;

-- 4. Email verifications table
CREATE TABLE IF NOT EXISTS email_verifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT fk_email_verifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_email_verifications_token (token),
  INDEX idx_email_verifications_user_id (user_id),
  INDEX idx_email_verifications_expires_at (expires_at)
) ENGINE=InnoDB;

-- 5. Password resets table
CREATE TABLE IF NOT EXISTS password_resets (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_password_resets_token (token),
  INDEX idx_password_resets_user_id (user_id),
  INDEX idx_password_resets_expires_at (expires_at)
) ENGINE=InnoDB;

-- 6. Color matches table
CREATE TABLE IF NOT EXISTS color_matches (
  id VARCHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  base_color VARCHAR(7) NOT NULL,
  scheme ENUM('analogous', 'complementary', 'split-complementary', 'triadic', 'tetradic', 'monochromatic', 'compound', 'shades', 'tints') NOT NULL,
  colors JSON NOT NULL,
  title VARCHAR(255),
  description TEXT,
  privacy ENUM('public', 'private') DEFAULT 'private' NOT NULL,
  is_locked TINYINT(1) DEFAULT 0,
  locked_color VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT colors_valid CHECK (JSON_VALID(colors)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_color_matches_user_id (user_id),
  INDEX idx_color_matches_privacy (privacy),
  INDEX idx_color_matches_created_at (created_at),
  INDEX idx_color_matches_scheme (scheme),
  INDEX idx_color_matches_user_created (user_id ASC, created_at DESC),
  INDEX idx_color_matches_privacy_created (privacy ASC, created_at DESC)
) ENGINE=InnoDB;

-- 7. Boards table
CREATE TABLE IF NOT EXISTS boards (
  id VARCHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  scheme VARCHAR(20),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_boards_user_id (user_id)
) ENGINE=InnoDB;

-- 8. Board items table
CREATE TABLE IF NOT EXISTS board_items (
  id VARCHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
  board_id VARCHAR(36) NOT NULL,
  color_match_id VARCHAR(36) NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (color_match_id) REFERENCES color_matches(id) ON DELETE CASCADE,
  INDEX color_match_id (color_match_id),
  INDEX idx_board_items_board_id (board_id)
) ENGINE=InnoDB;

-- 9. Follows table
CREATE TABLE IF NOT EXISTS follows (
  id CHAR(36) PRIMARY KEY,
  follower_id CHAR(36) NOT NULL,
  following_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_follow (follower_id, following_id)
) ENGINE=InnoDB;

-- 10. User follows table (alternative follow system)
CREATE TABLE IF NOT EXISTS user_follows (
  id VARCHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
  follower_id VARCHAR(36) NOT NULL,
  following_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_follow UNIQUE (follower_id, following_id),
  CONSTRAINT fk_user_follows_follower FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_follows_following FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_follows_follower_id (follower_id),
  INDEX idx_user_follows_following_id (following_id)
) ENGINE=InnoDB;

-- 11. Color match likes table
CREATE TABLE IF NOT EXISTS color_match_likes (
  id VARCHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  color_match_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_color_like UNIQUE (user_id, color_match_id),
  CONSTRAINT fk_color_match_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_color_match_likes_color_match FOREIGN KEY (color_match_id) REFERENCES color_matches(id) ON DELETE CASCADE,
  INDEX idx_color_match_likes_user_id (user_id),
  INDEX idx_color_match_likes_color_match_id (color_match_id),
  INDEX idx_color_match_likes_created_at (created_at)
) ENGINE=InnoDB;

-- 12. Posts table
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255),
  content TEXT,
  image_url VARCHAR(500),
  color_match_id VARCHAR(36),
  privacy ENUM('public', 'private') DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_posts_color_match FOREIGN KEY (color_match_id) REFERENCES color_matches(id) ON DELETE SET NULL,
  INDEX idx_posts_user_id (user_id),
  INDEX idx_posts_created_at (created_at),
  INDEX idx_posts_privacy (privacy)
) ENGINE=InnoDB;

-- 13. Post comments table
CREATE TABLE IF NOT EXISTS post_comments (
  id VARCHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_post_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_post_comments_post_id (post_id),
  INDEX idx_post_comments_user_id (user_id),
  INDEX idx_post_comments_created_at (created_at)
) ENGINE=InnoDB;

-- 14. Post likes table
CREATE TABLE IF NOT EXISTS post_likes (
  id VARCHAR(36) DEFAULT (UUID()) NOT NULL PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_post_like UNIQUE (post_id, user_id),
  CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_post_likes_post_id (post_id),
  INDEX idx_post_likes_user_id (user_id)
) ENGINE=InnoDB;

-- Verify all tables were created
SELECT 'Tables created successfully!' AS status;
