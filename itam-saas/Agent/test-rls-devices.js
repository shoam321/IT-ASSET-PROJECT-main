import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function testRLS() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n🧪 Testing RLS with different user IDs:\n');
    
    // Test as User ID 7 (your non-admin account)
    await pool.query("SELECT set_config('app.current_user_id', '7', false)");
    const test1 = await pool.query('SELECT * FROM devices');
    console.log(`User ID 7 (non-admin) sees: ${test1.rows.length} devices`);
    test1.rows.forEach(d => console.log(`  - ${d.device_name} (owner: user_id ${d.user_id})`));
    
    console.log('');
    
    // Test as User ID 1 (admin)
    await pool.query("SELECT set_config('app.current_user_id', '1', false)");
    const test2 = await pool.query('SELECT * FROM devices');
    console.log(`User ID 1 (admin) sees: ${test2.rows.length} devices`);
    test2.rows.forEach(d => console.log(`  - ${d.device_name} (owner: user_id ${d.user_id})`));
    
    console.log('');
    
    // Test as User ID 3
    await pool.query("SELECT set_config('app.current_user_id', '3', false)");
    const test3 = await pool.query('SELECT * FROM devices');
    console.log(`User ID 3 (non-admin) sees: ${test3.rows.length} devices`);
    test3.rows.forEach(d => console.log(`  - ${d.device_name} (owner: user_id ${d.user_id})`));
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testRLS();
