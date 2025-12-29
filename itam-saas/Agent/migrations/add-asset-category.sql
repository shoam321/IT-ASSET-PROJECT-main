-- Add category column to assets table
-- This allows categorizing assets by IT equipment type

DO $$ 
BEGIN
  -- Add category column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='assets' AND column_name='category') THEN
    ALTER TABLE assets ADD COLUMN category VARCHAR(100);
    RAISE NOTICE 'Added category column to assets table';
  ELSE
    RAISE NOTICE 'Category column already exists';
  END IF;
END $$;

-- Update existing assets with default categories based on asset_type
UPDATE assets 
SET category = CASE 
  WHEN asset_type = 'hardware' THEN 'Computer'
  WHEN asset_type = 'network' THEN 'Network Equipment'
  WHEN asset_type = 'software' THEN 'Software'
  WHEN asset_type = 'cloud' THEN 'Cloud Service'
  ELSE 'Other'
END
WHERE category IS NULL;

-- Create index for faster category filtering
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);

-- Show confirmation
DO $$
DECLARE
  category_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO category_count FROM assets WHERE category IS NOT NULL;
  RAISE NOTICE 'Migration complete! % assets have categories assigned', category_count;
END $$;
