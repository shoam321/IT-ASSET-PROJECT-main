// EMERGENCY: Check if RLS is actually working
import pool from './db.js';

async function emergencySecurityCheck() {
  try {
    console.log('🚨 EMERGENCY SECURITY CHECK\n');
    console.log('Checking if Row-Level Security is actually enforced...\n');
    
    // 1. Check if RLS is enabled
    console.log('1️⃣ Checking if RLS is enabled on tables:');
    const rlsStatus = await pool.query(`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('devices', 'device_usage', 'assets')
      ORDER BY tablename
    `);
    console.table(rlsStatus.rows);
    
    const devicesRLS = rlsStatus.rows.find(r => r.tablename === 'devices');
    if (!devicesRLS?.rowsecurity) {
      console.log('❌ CRITICAL: RLS is NOT enabled on devices table!\n');
    }
    
    // 2. Check if policies exist
    console.log('\n2️⃣ Checking RLS policies:');
    const policies = await pool.query(`
      SELECT tablename, policyname, cmd
      FROM pg_policies 
      WHERE schemaname = 'public'
        AND tablename IN ('devices', 'device_usage', 'assets')
      ORDER BY tablename, policyname
    `);
    
    if (policies.rows.length === 0) {
      console.log('❌ CRITICAL: NO RLS POLICIES FOUND!\n');
      console.log('This means ALL users can see ALL data!\n');
    } else {
      console.table(policies.rows);
    }
    
    // 3. Check user roles
    console.log('\n3️⃣ Checking users and roles:');
    const users = await pool.query(`
      SELECT id, username, email, role, created_at 
      FROM auth_users 
      ORDER BY created_at
      LIMIT 10
    `);
    console.table(users.rows);
    
    // 4. Check device ownership
    console.log('\n4️⃣ Checking device ownership:');
    const devices = await pool.query(`
      SELECT d.device_id, d.hostname, d.user_id, u.username, u.email, u.role
      FROM devices d
      LEFT JOIN auth_users u ON d.user_id = u.id
      ORDER BY d.last_seen DESC
      LIMIT 10
    `);
    console.table(devices.rows);
    
    // 5. Check for NULL user_ids
    const nullDevices = devices.rows.filter(d => d.user_id === null);
    if (nullDevices.length > 0) {
      console.log(`\n⚠️ WARNING: ${nullDevices.length} devices have NULL user_id!`);
      console.log('These devices will be visible to everyone!\n');
    }
    
    // 6. Test RLS enforcement
    console.log('\n5️⃣ Testing RLS enforcement:');
    console.log('Setting current_user_id to 999999 (non-existent user)...');
    await pool.query("SELECT set_config('app.current_user_id', '999999', false)");
    
    const testQuery = await pool.query('SELECT COUNT(*) as count FROM devices');
    const visibleCount = parseInt(testQuery.rows[0].count);
    
    if (visibleCount > 0) {
      console.log(`❌ SECURITY BREACH: Non-existent user can see ${visibleCount} devices!`);
      console.log('RLS is NOT working correctly!\n');
    } else {
      console.log('✅ RLS is working: Non-existent user sees 0 devices\n');
    }
    
    // 7. Summary
    console.log('\n═══════════════════════════════════════');
    console.log('📊 SECURITY SUMMARY');
    console.log('═══════════════════════════════════════\n');
    
    const issues = [];
    if (!devicesRLS?.rowsecurity) issues.push('RLS not enabled on devices table');
    if (policies.rows.length === 0) issues.push('No RLS policies found');
    if (nullDevices.length > 0) issues.push(`${nullDevices.length} devices with NULL user_id`);
    if (visibleCount > 0) issues.push('RLS enforcement failed');
    
    if (issues.length > 0) {
      console.log('❌ CRITICAL ISSUES FOUND:');
      issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
      console.log('\n🔧 Run fix-rls-now.js to resolve these issues\n');
    } else {
      console.log('✅ All security checks passed!\n');
    }
    
    await pool.end();
    process.exit(issues.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

emergencySecurityCheck();
