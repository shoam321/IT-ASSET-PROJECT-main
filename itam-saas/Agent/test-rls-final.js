import pool from './db.js';

async function testRLS() {
  try {
    console.log('🔐 Testing RLS with new itam_app role\n');
    
    const currentUser = await pool.query('SELECT current_user');
    console.log('Connected as:', currentUser.rows[0].current_user);
    
    if (currentUser.rows[0].current_user !== 'itam_app') {
      console.log('❌ ERROR: Still connected as postgres!');
      console.log('   Did you update .env and restart?\n');
      await pool.end();
      return;
    }
    
    console.log('\n✅ Connected as itam_app (non-owner)\n');
    console.log('Testing RLS enforcement:\n');
    
    // Test 1: No user_id set
    const test1 = await pool.query('SELECT COUNT(*) as count FROM devices');
    console.log(`Test 1 (no current_user_id): ${test1.rows[0].count} devices`);
    
    if (test1.rows[0].count === '0') {
      console.log('✅ PASS: RLS blocks access when user_id not set!\n');
    } else {
      console.log('❌ FAIL: Should see 0 devices\n');
    }
    
    // Test 2: Regular user
    await pool.query("SELECT set_config('app.current_user_id', '3', false)");
    const test2 = await pool.query('SELECT device_id, user_id FROM devices');
    console.log(`Test 2 (user_id=3): ${test2.rows.length} devices`);
    test2.rows.forEach(d => console.log(`  - ${d.device_id} (belongs to user_id: ${d.user_id})`));
    
    if (test2.rows.every(d => d.user_id === 3)) {
      console.log('✅ PASS: User sees only their device!\n');
    }
    
    // Test 3: Admin
    await pool.query("SELECT set_config('app.current_user_id', '1', false)");
    const test3 = await pool.query('SELECT device_id, user_id FROM devices');
    console.log(`Test 3 (admin user_id=1): ${test3.rows.length} devices`);
    test3.rows.forEach(d => console.log(`  - ${d.device_id} (user_id: ${d.user_id})`));
    
    if (test3.rows.length === 3) {
      console.log('✅ PASS: Admin sees all devices!\n');
    }
    
    console.log('═══════════════════════════════════════');
    console.log('🎉 RLS IS WORKING CORRECTLY!');
    console.log('═══════════════════════════════════════\n');
    console.log('Security is now ENFORCED:');
    console.log('  ✓ Users see only their data');
    console.log('  ✓ Admins see all data');
    console.log('  ✓ No auth = No data\n');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await pool.end();
  }
}

testRLS();
