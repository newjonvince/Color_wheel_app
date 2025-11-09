-- Update color_matches table to support new color schemes
-- This adds the missing color schemes from your enhanced color system

-- First, modify the ENUM to include new schemes
ALTER TABLE color_matches 
MODIFY COLUMN scheme ENUM(
  'analogous', 
  'complementary', 
  'split-complementary', 
  'triadic', 
  'tetradic', 
  'monochromatic',
  'compound',
  'shades', 
  'tints'
) NOT NULL;

-- Add index for better performance on scheme queries
CREATE INDEX IF NOT EXISTS idx_color_matches_scheme_privacy 
ON color_matches (scheme, privacy, created_at DESC);

-- Verify the update
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'color_matches' 
AND COLUMN_NAME = 'scheme' 
AND TABLE_SCHEMA = DATABASE();
