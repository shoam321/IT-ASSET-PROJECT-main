import pool from './db.js';

async function checkReceipts() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking receipts in database...\n');
    
    const result = await client.query(`
      SELECT 
        id, 
        file_name, 
        merchant, 
        total_amount, 
        currency,
        purchase_date,
        tax_amount,
        parsing_status,
        parsed_data
      FROM receipts 
      ORDER BY upload_date DESC 
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No receipts found in database');
      return;
    }
    
    console.log(`✅ Found ${result.rows.length} receipt(s):\n`);
    
    result.rows.forEach((receipt, index) => {
      console.log(`Receipt #${index + 1}:`);
      console.log(`  File: ${receipt.file_name}`);
      console.log(`  Status: ${receipt.parsing_status}`);
      console.log(`  Merchant: ${receipt.merchant || 'NULL'}`);
      console.log(`  Total: ${receipt.currency || '$'}${receipt.total_amount || 'NULL'}`);
      console.log(`  Date: ${receipt.purchase_date || 'NULL'}`);
      console.log(`  Tax: ${receipt.tax_amount || 'NULL'}`);
      console.log(`  Parsed Data: ${JSON.stringify(receipt.parsed_data, null, 2)}`);
      console.log('---\n');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkReceipts()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
