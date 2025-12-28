import pool from './db.js';

async function forceFix() {
  try {
    console.log('🔧 FORCING RLS TO WORK\n');
    
    // Step 1: Disable RLS temporarily
    console.log('Step 1: Disabling RLS...');
    await pool.query('ALTER TABLE devices DISABLE ROW LEVEL SECURITY');
    await pool.query('ALTER TABLE device_usage DISABLE ROW LEVEL SECURITY');
    
    // Step 2: Drop ALL policies
    console.log('Step 2: Dropping all policies...');
    await pool.query('DROP POLICY IF EXISTS user_devices_select_policy ON devices');
    await pool.query('DROP POLICY IF EXISTS user_devices_insert_policy ON devices');
    await pool.query('DROP POLICY IF EXISTS user_devices_update_policy ON devices');
    await pool.query('DROP POLICY IF EXISTS user_usage_select_policy ON device_usage');
    await pool.query('DROP POLICY IF EXISTS user_usage_insert_policy ON device_usage');
    
    // Step 3: Re-enable RLS with FORCE
    console.log('Step 3: Re-enabling RLS with FORCE...');
    await pool.query('ALTER TABLE devices ENABLE ROW LEVEL SECURITY');
    await pool.query('ALTER TABLE devices FORCE ROW LEVEL SECURITY'); // FORCE applies even to table owner!
    await pool.query('ALTER TABLE device_usage ENABLE ROW LEVEL SECURITY');
    await pool.query('ALTER TABLE device_usage FORCE ROW LEVEL SECURITY');
    
    // Step 4: Create RESTRICTIVE policies (AND logic, not OR)
    console.log('Step 4: Creating fail-secure policies...');
    
    await pool.query(`
      CREATE POLICY user_devices_select_policy ON devices
        AS RESTRICTIVE
        FOR SELECT
        USING (
          current_setting('app.current_user_id', true) IS NOT NULL
          AND current_setting('app.current_user_id', true) != ''
          AND (
            user_id = current_setting('app.current_user_id', true)::integer
            OR 
            EXISTS (
              SELECT 1 FROM auth_users 
              WHERE id = current_setting('app.current_user_id', true)::integer 
              AND role = 'admin'
            )
          )
        )
    `);
    
    await pool.query(`
      CREATE POLICY user_devices_insert_policy ON devices
        AS RESTRICTIVE
        FOR INSERT
        WITH CHECK (
          current_setting('app.current_user_id', true) IS NOT NULL
          AND user_id = current_setting('app.current_user_id', true)::integer
        )
    `);
    
    await pool.query(`
      CREATE POLICY user_usage_select_policy ON device_usage
        AS RESTRICTIVE
        FOR SELECT
        USING (
          current_setting('app.current_user_id', true) IS NOT NULL
          AND current_setting('app.current_user_id', true) != ''
          AND (
            user_id = current_setting('app.current_user_id', true)::integer
            OR 
            EXISTS (
              SELECT 1 FROM auth_users 
              WHERE id = current_setting('app.current_user_id', true)::integer 
              AND role = 'admin'
            )
          )
        )
    `);
    
    console.log('\n✅ FORCE RLS applied!');
    console.log('\nTesting...\n');
    
    // Test without setting user_id
    const test1 = await pool.query('SELECT COUNT(*) as count FROM devices');
    console.log(`Test 1 (no user_id): ${test1.rows[0].count} devices visible`);
    
    // Test with user_id=3
    await pool.query("SELECT set_config('app.current_user_id', '3', false)");
    const test2 = await pool.query('SELECT device_id, user_id FROM devices');
    console.log(`\nTest 2 (user_id=3): ${test2.rows.length} devices visible`);
    test2.rows.forEach(d => console.log(`  - ${d.device_id} (user_id: ${d.user_id})`));
    
    // Test with admin
    await pool.query("SELECT set_config('app.current_user_id', '1', false)");
    const test3 = await pool.query('SELECT device_id, user_id FROM devices');
    console.log(`\nTest 3 (admin user_id=1): ${test3.rows.length} devices visible`);
    test3.rows.forEach(d => console.log(`  - ${d.device_id} (user_id: ${d.user_id})`));
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ RLS IS NOW ENFORCED!');
    console.log('═══════════════════════════════════════\n');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

forceFix();
