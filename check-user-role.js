import pool from './itam-saas/Agent/db.js';

async function checkUserRole() {
  try {
    console.log('🔍 Checking user role and RLS policies...\n');
    
    // Check user role
    const userResult = await pool.query(
      `SELECT id, username, email, role FROM auth_users WHERE email = 'shoam052603866@gmail.com' OR username LIKE '%shoam%'`
    );
    
    console.log('👤 User Information:');
    console.table(userResult.rows);
    
    // Check if RLS is enabled on devices table
    const rlsCheck = await pool.query(`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE tablename = 'devices'
    `);
    
    console.log('\n🔒 Row-Level Security Status:');
    console.table(rlsCheck.rows);
    
    // Check policies on devices table
    const policiesCheck = await pool.query(`
      SELECT schemaname, tablename, policyname, cmd, qual 
      FROM pg_policies 
      WHERE tablename = 'devices'
    `);
    
    console.log('\n📋 RLS Policies on devices table:');
    if (policiesCheck.rows.length === 0) {
      console.log('❌ NO POLICIES FOUND - RLS migration has not been run!');
    } else {
      console.table(policiesCheck.rows);
    }
    
    // Check device ownership
    const devicesCheck = await pool.query(`
      SELECT device_id, hostname, user_id, last_seen 
      FROM devices 
      ORDER BY last_seen DESC 
      LIMIT 10
    `);
    
    console.log('\n💻 Device Ownership:');
    console.table(devicesCheck.rows);
    
    // Check if user_id column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'devices' AND column_name = 'user_id'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('\n❌ PROBLEM: user_id column does not exist in devices table!');
      console.log('   Run migration: node itam-saas/Agent/migrations/run-multi-tenancy-migration.js');
    } else {
      console.log('\n✅ user_id column exists in devices table');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserRole();
