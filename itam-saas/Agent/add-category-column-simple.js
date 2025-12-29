import pool from './db.js';

async function addCategoryColumn() {
  try {
    console.log('🔄 Adding category column to assets table...\n');
    
    // Try to add the column
    try {
      await pool.query(`ALTER TABLE assets ADD COLUMN category VARCHAR(100)`);
      console.log('✅ Category column added successfully!');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('ℹ️  Category column already exists');
      } else {
        throw e;
      }
    }
    
    // Try to create index
    try {
      await pool.query(`CREATE INDEX idx_assets_category ON assets(category)`);
      console.log('✅ Index created successfully!');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('ℹ️  Index already exists');
      } else {
        console.log('⚠️  Could not create index (not critical):', e.message);
      }
    }
    
    console.log('\n✅ Done! Restart your backend server now.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n📝 Please run this SQL manually in Railway Console or DBeaver:');
    console.error('   ALTER TABLE assets ADD COLUMN category VARCHAR(100);');
    console.error('   CREATE INDEX idx_assets_category ON assets(category);\n');
    process.exit(1);
  }
}

addCategoryColumn();
