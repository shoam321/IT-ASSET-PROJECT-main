import pool from './itam-saas/Agent/db.js';

async function fixDeviceUsageRLS() {
  try {
    console.log('🔍 Checking device_usage RLS policies...\n');
    
    // Step 1: Check current policies
    const policies = await pool.query(`
      SELECT * FROM pg_policies WHERE tablename = 'device_usage'
    `);
    
    console.log('Current policies:', policies.rows.length);
    policies.rows.forEach(p => {
      console.log(`  - ${p.policyname} (${p.cmd})`);
      console.log(`    USING: ${p.qual}`);
      console.log(`    CHECK: ${p.with_check}\n`);
    });
    
    // Step 2: Check if RLS is enabled
    const rlsStatus = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'device_usage'
    `);
    
    console.log('RLS Status:', rlsStatus.rows[0]?.rowsecurity ? '✅ ENABLED' : '❌ DISABLED');
    
    // Step 3: Fix the INSERT policy
    console.log('\n🔧 Fixing INSERT policy...\n');
    
    // Drop existing policy
    await pool.query('DROP POLICY IF EXISTS user_usage_insert_policy ON device_usage');
    
    // Create proper INSERT policy
    await pool.query(`
      CREATE POLICY user_usage_insert_policy ON device_usage
        FOR INSERT
        WITH CHECK (
          current_setting('app.current_user_id', true) IS NOT NULL
          AND current_setting('app.current_user_id', true) != ''
          AND user_id = current_setting('app.current_user_id', true)::integer
        )
    `);
    
    console.log('✅ INSERT policy created!\n');
    
    // Step 4: Verify all policies now
    const updatedPolicies = await pool.query(`
      SELECT policyname, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'device_usage'
      ORDER BY cmd
    `);
    
    console.log('📋 Updated policies:');
    updatedPolicies.rows.forEach(p => {
      console.log(`  ✓ ${p.policyname} (${p.cmd})`);
    });
    
    // Step 5: Test INSERT
    console.log('\n🧪 Testing INSERT...\n');
    
    await pool.query("SET app.current_user_id = '7'");
    
    const testInsert = await pool.query(`
      INSERT INTO device_usage (device_id, app_name, window_title, duration, timestamp, user_id)
      VALUES ('TEST-DEVICE', 'Test App', 'Test Window', 100, NOW(), 7)
      RETURNING *
    `);
    
    console.log('✅ INSERT successful!');
    console.log('   Inserted:', testInsert.rows[0]);
    
    // Clean up test data
    await pool.query(`DELETE FROM device_usage WHERE device_id = 'TEST-DEVICE'`);
    console.log('   Test data cleaned up\n');
    
    console.log('🎉 device_usage RLS is now properly configured!\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('   Code:', err.code);
    console.error('   Detail:', err.detail);
  } finally {
    await pool.end();
  }
}

fixDeviceUsageRLS();
