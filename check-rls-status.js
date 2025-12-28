// Check if RLS is actually enabled on Railway production database
import pool from './itam-saas/Agent/db.js';

async function checkRLSStatus() {
  try {
    console.log('🔍 Checking Row-Level Security Status on Production DB...\n');
    
    // Check if RLS is enabled
    const rlsEnabled = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename IN ('devices', 'device_usage', 'assets')
    `);
    
    console.log('📊 Tables with RLS:');
    console.table(rlsEnabled.rows);
    
    const devicesRLS = rlsEnabled.rows.find(r => r.tablename === 'devices');
    if (!devicesRLS || !devicesRLS.rowsecurity) {
      console.log('\n❌ PROBLEM FOUND: RLS is NOT enabled on devices table!');
      console.log('   This is why all users see all devices.\n');
      console.log('   FIX: Run the migration:');
      console.log('   node itam-saas/Agent/migrations/run-multi-tenancy-migration.js\n');
    } else {
      console.log('\n✅ RLS is enabled on devices table');
    }
    
    // Check if policies exist
    const policies = await pool.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd
      FROM pg_policies 
      WHERE tablename IN ('devices', 'device_usage', 'assets')
      ORDER BY tablename, policyname
    `);
    
    console.log('\n📋 RLS Policies:');
    if (policies.rows.length === 0) {
      console.log('❌ NO POLICIES FOUND!');
      console.log('   RLS is enabled but no policies exist.');
      console.log('   Without policies, ALL rows are visible to ALL users.\n');
      console.log('   FIX: Run the migration:');
      console.log('   node itam-saas/Agent/migrations/run-multi-tenancy-migration.js\n');
    } else {
      console.table(policies.rows);
    }
    
    // Check if user_id column exists
    const columns = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name IN ('devices', 'device_usage') 
        AND column_name = 'user_id'
    `);
    
    console.log('\n💾 User ID Columns:');
    if (columns.rows.length === 0) {
      console.log('❌ user_id column NOT FOUND!');
      console.log('   Migration has NOT been run.\n');
    } else {
      console.table(columns.rows);
    }
    
    // Check actual device data
    const devices = await pool.query(`
      SELECT device_id, hostname, user_id, last_seen 
      FROM devices 
      ORDER BY last_seen DESC 
      LIMIT 5
    `);
    
    console.log('\n💻 Sample Devices:');
    console.table(devices.rows);
    
    const nullUserIds = devices.rows.filter(d => d.user_id === null).length;
    if (nullUserIds > 0) {
      console.log(`\n⚠️  Warning: ${nullUserIds} device(s) have NULL user_id`);
      console.log('   These will be visible to all users with current RLS policies.\n');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nMake sure DATABASE_URL environment variable is set:');
    console.error('$env:DATABASE_URL = "your_railway_postgres_url"');
    await pool.end();
    process.exit(1);
  }
}

checkRLSStatus();
