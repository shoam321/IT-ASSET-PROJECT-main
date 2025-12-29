import pool from './db.js';

async function verifyReceiptsTable() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking receipts table...\n');
    
    // Check if table exists
    const tableExists = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'receipts';
    `);
    
    if (tableExists.rows.length === 0) {
      console.log('❌ receipts table does not exist');
      return;
    }
    
    console.log('✅ receipts table exists');
    
    // Check columns
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'receipts'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Table columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });
    
    // Check permissions
    console.log('\n🔐 Checking permissions for itam_app user...');
    const permissions = await client.query(`
      SELECT privilege_type
      FROM information_schema.table_privileges
      WHERE table_name = 'receipts'
      AND grantee = 'itam_app';
    `);
    
    if (permissions.rows.length > 0) {
      console.log('✅ Permissions granted:');
      permissions.rows.forEach(perm => {
        console.log(`  - ${perm.privilege_type}`);
      });
    } else {
      console.log('❌ No permissions found for itam_app user');
    }
    
    // Test query
    console.log('\n🧪 Testing SELECT query...');
    const testQuery = await client.query('SELECT COUNT(*) FROM receipts');
    console.log(`✅ Query successful - ${testQuery.rows[0].count} receipts in database`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyReceiptsTable()
  .then(() => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
