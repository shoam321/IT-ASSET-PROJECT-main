// Check the actual RLS policy definition
import pool from './db.js';

async function checkPolicyLogic() {
  try {
    console.log('Checking RLS policy definition...\n');
    
    const policyDef = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual as using_expression,
        with_check
      FROM pg_policies 
      WHERE tablename = 'devices' AND policyname = 'user_devices_select_policy'
    `);
    
    console.log('Policy Definition:');
    console.table(policyDef.rows);
    
    console.log('\nFull USING expression:');
    console.log(policyDef.rows[0]?.qual);
    
    // Test what current_setting returns
    console.log('\n\nTesting current_setting:');
    const test1 = await pool.query("SELECT current_setting('app.current_user_id', true) as value");
    console.log('Without set_config:', test1.rows[0].value);
    
    await pool.query("SELECT set_config('app.current_user_id', '7', false)");
    const test2 = await pool.query("SELECT current_setting('app.current_user_id', true) as value");
    console.log('After set_config(7):', test2.rows[0].value);
    
    // Try querying devices
    console.log('\n\nQuerying devices with user_id=7:');
    const devices = await pool.query('SELECT device_id, user_id FROM devices');
    console.table(devices.rows);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

checkPolicyLogic();
