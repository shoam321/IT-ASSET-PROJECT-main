import pkg from 'pg';
const { Pool } = pkg;

async function testWithAppUser() {
  const pool = new Pool({
    connectionString: 'postgresql://itam_app:itam_app_secure_2025@caboose.proxy.rlwy.net:31886/railway'
  });

  try {
    console.log('\n🧪 Testing RLS with itam_app user:\n');
    
    // Check current user
    const user = await pool.query('SELECT current_user, session_user');
    console.log(`Connected as: ${user.rows[0].current_user}\n`);
    
    // Test as User ID 7 (non-admin)
    await pool.query("SELECT set_config('app.current_user_id', '7', false)");
    const test1 = await pool.query('SELECT id, user_id FROM devices');
    console.log(`User ID 7 (non-admin) sees: ${test1.rows.length} device(s)`);
    test1.rows.forEach(d => console.log(`  - Device ID ${d.id} (owner: user_id ${d.user_id})`));
    
    console.log('');
    
    // Test as User ID 1 (admin)
    await pool.query("SELECT set_config('app.current_user_id', '1', false)");
    const test2 = await pool.query('SELECT id, user_id FROM devices');
    console.log(`User ID 1 (admin) sees: ${test2.rows.length} device(s)`);
    test2.rows.forEach(d => console.log(`  - Device ID ${d.id} (owner: user_id ${d.user_id})`));
    
    console.log('\n✅ RLS is now working correctly!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testWithAppUser();
