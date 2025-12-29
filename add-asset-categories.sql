-- Asset Categories Migration
-- Run this in your database client (DBeaver, pgAdmin, Railway Console, etc.)
-- This adds category support to the assets table

-- Step 1: Add category column to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);

-- Step 3: Update existing assets with default categories based on asset_type
UPDATE assets 
SET category = CASE 
  WHEN asset_type = 'hardware' THEN 'computer'
  WHEN asset_type = 'network' THEN 'network-switch'
  WHEN asset_type = 'software' THEN 'software'
  WHEN asset_type = 'cloud' THEN 'cloud'
  ELSE 'other'
END
WHERE category IS NULL;

-- Verification: Check the category distribution
SELECT category, COUNT(*) as count 
FROM assets 
GROUP BY category 
ORDER BY count DESC;

-- Success!
-- The category column has been added to your assets table
-- Restart your backend and refresh your frontend to see the changes
