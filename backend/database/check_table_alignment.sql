-- Check if your color_matches table is aligned with application expectations
-- Run these queries in your MySQL database

-- 1. Check current color_matches table structure
DESCRIBE color_matches;

-- 2. Check the ENUM values for scheme column (CRITICAL CHECK)
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'color_matches' 
AND COLUMN_NAME = 'scheme' 
AND TABLE_SCHEMA = 'FashionWheel';

-- 3. Check if color_match_likes table exists and structure
DESCRIBE color_match_likes;

-- 4. Verify all required columns exist in color_matches
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT,
  CHARACTER_MAXIMUM_LENGTH,
  COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'color_matches' 
AND TABLE_SCHEMA = 'FashionWheel'
ORDER BY ORDINAL_POSITION;

-- 5. Check for any existing data that might conflict with new schemes
SELECT scheme, COUNT(*) as count
FROM color_matches 
GROUP BY scheme
ORDER BY count DESC;

-- 6. Test if JSON colors column is working properly
SELECT 
  id, 
  colors, 
  JSON_VALID(colors) as is_valid_json,
  JSON_LENGTH(colors) as color_count
FROM color_matches 
LIMIT 5;

-- 7. Check indexes on color_matches table
SELECT 
  INDEX_NAME, 
  COLUMN_NAME, 
  SEQ_IN_INDEX, 
  NON_UNIQUE,
  INDEX_TYPE
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'FashionWheel' 
AND TABLE_NAME = 'color_matches'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- 8. Check foreign key relationships
SELECT 
  CONSTRAINT_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME,
  DELETE_RULE,
  UPDATE_RULE
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'FashionWheel' 
AND TABLE_NAME IN ('color_matches', 'color_match_likes')
AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 9. Check if your table supports all 9 color schemes
-- This should return TRUE if your table is updated
SELECT 
  CASE 
    WHEN COLUMN_TYPE LIKE '%compound%' 
     AND COLUMN_TYPE LIKE '%shades%' 
     AND COLUMN_TYPE LIKE '%tints%' 
    THEN 'UPDATED - Supports all 9 schemes' 
    ELSE 'NEEDS UPDATE - Missing new schemes' 
  END as scheme_status,
  COLUMN_TYPE as current_enum_values
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'color_matches' 
AND COLUMN_NAME = 'scheme' 
AND TABLE_SCHEMA = 'FashionWheel';

-- 10. Test inserting a new color scheme (compound) - ONLY RUN IF UPDATED
-- INSERT INTO color_matches (user_id, base_color, scheme, colors, privacy) 
-- VALUES ('test-user-id', '#FF0000', 'compound', '["#FF0000", "#00FF00", "#0000FF"]', 'private');
