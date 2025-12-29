import pool from './db.js';

async function addReceiptParsingColumns() {
  const client = await pool.connect();
  try {
    console.log('🔧 Adding receipt parsing columns...\n');
    
    await client.query(`
      -- Add columns for Mindee parsed data
      ALTER TABLE receipts 
      ADD COLUMN IF NOT EXISTS merchant VARCHAR(255),
      ADD COLUMN IF NOT EXISTS purchase_date DATE,
      ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS currency VARCHAR(10),
      ADD COLUMN IF NOT EXISTS parsed_data JSONB,
      ADD COLUMN IF NOT EXISTS parsing_status VARCHAR(50) DEFAULT 'pending';
    `);
    
    console.log('✅ Columns added successfully');
    
    // Verify columns
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'receipts'
      AND column_name IN ('merchant', 'purchase_date', 'total_amount', 'tax_amount', 'currency', 'parsed_data', 'parsing_status')
      ORDER BY column_name;
    `);
    
    console.log('\n📋 New columns:');
    columns.rows.forEach(col => {
      console.log(`  ✅ ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addReceiptParsingColumns()
  .then(() => {
    console.log('\n✅ Done! Receipt parsing columns added.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
