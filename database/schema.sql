-- Fashion Color Wheel Database Schema
-- MySQL Database Setup

-- Users table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    location VARCHAR(100),
    birthday_month VARCHAR(20),
    birthday_day INT,
    birthday_year INT,
    gender VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Color matches/combinations table
CREATE TABLE color_matches (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    base_color VARCHAR(7) NOT NULL, -- hex color like #FF6B6B
    scheme VARCHAR(20) NOT NULL, -- complementary, analogous, etc.
    colors JSON NOT NULL, -- array of hex colors
    privacy VARCHAR(10) DEFAULT 'private', -- private or public
    is_locked BOOLEAN DEFAULT FALSE,
    locked_color VARCHAR(7), -- if color was extracted and locked
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Boards/folders table
CREATE TABLE boards (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- private or public
    scheme VARCHAR(20), -- complementary, analogous, triadic, etc.
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Board items (color matches saved to boards)
CREATE TABLE board_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    board_id VARCHAR(36) NOT NULL,
    color_match_id VARCHAR(36) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (color_match_id) REFERENCES color_matches(id) ON DELETE CASCADE
);

-- User sessions table
CREATE TABLE user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_sessions_user_id (user_id),
    INDEX idx_user_sessions_token_hash (token_hash),
    INDEX idx_user_sessions_expires_at (expires_at)
);

-- Create posts table for community posts
CREATE TABLE posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    colors JSON,
    image_url VARCHAR(500),
    description TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_posts_user_id (user_id),
    INDEX idx_posts_is_public (is_public),
    INDEX idx_posts_created_at (created_at)
);

-- Create user_follows table for follow relationships
CREATE TABLE user_follows (
    id INT PRIMARY KEY AUTO_INCREMENT,
    follower_id INT NOT NULL,
    following_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_follow (follower_id, following_id),
    INDEX idx_user_follows_follower (follower_id),
    INDEX idx_user_follows_following (following_id)
);

-- Create post_likes table for post likes
CREATE TABLE post_likes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (user_id, post_id),
    INDEX idx_post_likes_user (user_id),
    INDEX idx_post_likes_post (post_id)
);

-- Create post_comments table for post comments
CREATE TABLE post_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    INDEX idx_post_comments_user (user_id),
    INDEX idx_post_comments_post (post_id),
    INDEX idx_post_comments_created_at (created_at)
);

-- Likes/interactions table (for social features)
CREATE TABLE color_match_likes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    color_match_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_color_like (user_id, color_match_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (color_match_id) REFERENCES color_matches(id) ON DELETE CASCADE
);

-- User preferences table
CREATE TABLE user_preferences (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    skin_tone VARCHAR(50),
    favorite_colors JSON, -- array of preferred colors
    style_personality VARCHAR(50), -- bold, minimalist, romantic, etc.
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_color_matches_user_id ON color_matches(user_id);
CREATE INDEX idx_color_matches_privacy ON color_matches(privacy);
CREATE INDEX idx_color_matches_created_at ON color_matches(created_at);
CREATE INDEX idx_boards_user_id ON boards(user_id);
CREATE INDEX idx_board_items_board_id ON board_items(board_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_color_match_likes_user_id ON color_match_likes(user_id);
CREATE INDEX idx_color_match_likes_color_match_id ON color_match_likes(color_match_id);

-- Sample data for testing
SET @demo_user_id = UUID();
SET @test_user_id = UUID();

INSERT INTO users (id, email, username, password_hash, location, gender) VALUES
(@demo_user_id, 'demo@fashioncolorwheel.com', 'demo_user', '$2b$10$example_hash', 'United States', 'Prefer not to say'),
(@test_user_id, 'test@example.com', 'test_user', '$2b$10$example_hash', 'Canada', 'Female');

-- Create default boards for demo user
INSERT INTO boards (user_id, name, type, scheme) VALUES
(@demo_user_id, 'Private Complementary', 'private', 'complementary'),
(@demo_user_id, 'Private Analogous', 'private', 'analogous'),
(@demo_user_id, 'Private Triadic', 'private', 'triadic'),
(@demo_user_id, 'Private Tetradic', 'private', 'tetradic'),
(@demo_user_id, 'Private Monochromatic', 'private', 'monochromatic'),
(@demo_user_id, 'Public Complementary', 'public', 'complementary'),
(@demo_user_id, 'Public Analogous', 'public', 'analogous'),
(@demo_user_id, 'Public Triadic', 'public', 'triadic'),
(@demo_user_id, 'Public Tetradic', 'public', 'tetradic'),
(@demo_user_id, 'Public Monochromatic', 'public', 'monochromatic');
