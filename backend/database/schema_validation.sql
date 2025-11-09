-- Schema validation queries to check database alignment
-- Run these to verify your database matches your application expectations

-- 1. Check color_matches table structure
DESCRIBE color_matches;

-- 2. Check current ENUM values for scheme column
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'color_matches' 
AND COLUMN_NAME = 'scheme' 
AND TABLE_SCHEMA = DATABASE();

-- 3. Check if all required tables exist
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN (
  'users', 
  'color_matches', 
  'boards', 
  'board_items', 
  'user_preferences', 
  'user_sessions', 
  'email_verifications', 
  'password_resets',
  'follows'
);

-- 4. Check indexes on critical tables
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME IN ('color_matches', 'users', 'user_sessions')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 5. Check foreign key constraints
SELECT 
  TABLE_NAME,
  COLUMN_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() 
AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 6. Check for any color_matches with schemes not in the current ENUM
SELECT scheme, COUNT(*) as count
FROM color_matches 
GROUP BY scheme
ORDER BY count DESC;

-- 7. Check JSON column validity
SELECT id, colors, JSON_VALID(colors) as is_valid_json
FROM color_matches 
WHERE JSON_VALID(colors) = 0
LIMIT 5;

-- 8. Check user table structure matches AuthService expectations
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT,
  CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users' 
AND TABLE_SCHEMA = DATABASE()
ORDER BY ORDINAL_POSITION;

-- 9. Check session table structure for JWT compatibility
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'user_sessions' 
AND TABLE_SCHEMA = DATABASE()
ORDER BY ORDINAL_POSITION;
