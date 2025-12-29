import pool from './db.js';

async function createReceiptsTable() {
  const client = await pool.connect();
  try {
    console.log('🗄️  Creating receipts table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS receipts (
        id SERIAL PRIMARY KEY,
        asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(100),
        file_size INTEGER,
        description TEXT,
        uploaded_by INTEGER REFERENCES auth_users(id),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Receipts table created successfully');
    
    console.log('📊 Creating indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_receipts_asset_id ON receipts(asset_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_upload_date ON receipts(upload_date);
    `);
    
    console.log('✅ Indexes created successfully');
    
    // Verify table exists
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'receipts';
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verified: receipts table exists in database');
    } else {
      console.log('❌ Error: receipts table not found after creation');
    }
    
  } catch (error) {
    console.error('❌ Error creating receipts table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createReceiptsTable()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
