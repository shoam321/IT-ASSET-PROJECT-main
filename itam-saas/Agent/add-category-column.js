import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function addCategoryColumn() {
  // Try DATABASE_URL_OWNER first, fallback to DATABASE_URL
  const connectionString = process.env.DATABASE_URL_OWNER || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });

  try {
    console.log('🔄 Adding category column to assets table...\n');
    
    // Check if column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'assets' AND column_name = 'category'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ Category column already exists');
      return;
    }
    
    // Add category column
    await pool.query(`ALTER TABLE assets ADD COLUMN category VARCHAR(100)`);
    console.log('✅ Added category column to assets table');
    
    // Create index
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category)`);
    console.log('✅ Created index on category column');
    
    // Update existing assets with default categories
    await pool.query(`
      UPDATE assets 
      SET category = CASE 
        WHEN asset_type = 'hardware' THEN 'computer'
        WHEN asset_type = 'network' THEN 'network-switch'
        WHEN asset_type = 'software' THEN 'software'
        WHEN asset_type = 'cloud' THEN 'cloud'
        ELSE 'other'
      END
      WHERE category IS NULL
    `);
    console.log('✅ Updated existing assets with default categories\n');
    
    // Show results
    const result = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM assets 
      WHERE category IS NOT NULL 
      GROUP BY category
    `);
    
    console.log('📊 Category distribution:');
    result.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.count} assets`);
    });
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addCategoryColumn();
