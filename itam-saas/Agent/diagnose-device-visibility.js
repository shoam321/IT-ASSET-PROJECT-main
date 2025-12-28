#!/usr/bin/env node

/**
 * Diagnose Device Visibility Issue
 * Checks if users can see devices they shouldn't see
 */

import pool from './db.js';

async function diagnoseVisibility() {
  try {
    console.log('🔍 DIAGNOSING DEVICE VISIBILITY ISSUE\n');
    console.log('═══════════════════════════════════════\n');

    // 1. Check all users
    console.log('1️⃣ Users in system:\n');
    const users = await pool.query(`
      SELECT id, username, email, role 
      FROM auth_users 
      ORDER BY id
    `);
    console.table(users.rows);
    
    if (users.rows.length === 0) {
      console.log('❌ No users found!\n');
      await pool.end();
      return;
    }

    // 2. Check all devices (without RLS)
    console.log('\n2️⃣ All devices in database (admin view):\n');
    const allDevices = await pool.query(`
      SELECT d.device_id, d.hostname, d.user_id, u.username as owner
      FROM devices d
      LEFT JOIN auth_users u ON d.user_id = u.id
      ORDER BY d.last_seen DESC
    `);
    console.table(allDevices.rows);
    
    const totalDevices = allDevices.rows.length;
    console.log(`Total devices: ${totalDevices}\n`);
    
    if (totalDevices === 0) {
      console.log('ℹ️  No devices in database yet.\n');
      await pool.end();
      return;
    }

    // 3. Test RLS for each user
    console.log('\n3️⃣ Testing what each user can see:\n');
    console.log('═══════════════════════════════════════\n');
    
    for (const user of users.rows) {
      console.log(`Testing User: ${user.username} (${user.role}) [ID: ${user.id}]`);
      
      // Set user context
      await pool.query(`SELECT set_config('app.current_user_id', $1, false)`, [user.id.toString()]);
      
      // Query devices as this user
      const userDevices = await pool.query(`
        SELECT device_id, user_id 
        FROM devices
      `);
      
      const visibleCount = userDevices.rows.length;
      const ownedCount = userDevices.rows.filter(d => d.user_id === user.id).length;
      const othersCount = userDevices.rows.filter(d => d.user_id !== user.id).length;
      
      console.log(`  • Can see: ${visibleCount} devices`);
      console.log(`  • Own: ${ownedCount} devices`);
      console.log(`  • Others: ${othersCount} devices`);
      
      if (user.role === 'admin') {
        if (visibleCount === totalDevices) {
          console.log(`  ✅ CORRECT: Admin sees all ${totalDevices} devices\n`);
        } else {
          console.log(`  ⚠️  ISSUE: Admin should see all ${totalDevices} but only sees ${visibleCount}\n`);
        }
      } else {
        if (othersCount > 0) {
          console.log(`  ❌ SECURITY ISSUE: User can see ${othersCount} devices from OTHER users!\n`);
          console.log('  Devices they can see:');
          console.table(userDevices.rows);
        } else {
          console.log(`  ✅ CORRECT: User only sees their own ${ownedCount} device(s)\n`);
        }
      }
    }

    // 4. Test unauthenticated access
    console.log('═══════════════════════════════════════\n');
    console.log('4️⃣ Testing unauthenticated access:\n');
    
    // Clear user context
    await pool.query(`SELECT set_config('app.current_user_id', '', false)`);
    
    const noAuthDevices = await pool.query(`SELECT COUNT(*) as count FROM devices`);
    const noAuthCount = parseInt(noAuthDevices.rows[0].count);
    
    if (noAuthCount === 0) {
      console.log('✅ CORRECT: Unauthenticated access returns 0 devices\n');
    } else {
      console.log(`❌ SECURITY ISSUE: Unauthenticated access returns ${noAuthCount} devices!\n`);
    }

    // 5. Check RLS policies
    console.log('═══════════════════════════════════════\n');
    console.log('5️⃣ RLS Configuration:\n');
    
    const rlsStatus = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('devices', 'device_usage')
    `);
    console.table(rlsStatus.rows);
    
    const policies = await pool.query(`
      SELECT tablename, policyname, cmd
      FROM pg_policies 
      WHERE tablename IN ('devices', 'device_usage')
      ORDER BY tablename, policyname
    `);
    
    console.log('\nPolicies:');
    console.table(policies.rows);

    // 6. Summary
    console.log('\n═══════════════════════════════════════');
    console.log('📊 DIAGNOSIS SUMMARY');
    console.log('═══════════════════════════════════════\n');
    
    const issues = [];
    
    const devicesRLS = rlsStatus.rows.find(r => r.tablename === 'devices');
    if (!devicesRLS?.rowsecurity) {
      issues.push('RLS not enabled on devices table');
    }
    
    if (policies.rows.length === 0) {
      issues.push('No RLS policies found');
    }
    
    if (noAuthCount > 0) {
      issues.push('Unauthenticated access shows devices');
    }
    
    // Check if any regular users can see other users' devices
    let hasSecurityIssue = false;
    for (const user of users.rows.filter(u => u.role !== 'admin')) {
      await pool.query(`SELECT set_config('app.current_user_id', $1, false)`, [user.id.toString()]);
      const userDevices = await pool.query(`SELECT user_id FROM devices`);
      const othersCount = userDevices.rows.filter(d => d.user_id !== user.id).length;
      if (othersCount > 0) {
        issues.push(`User ${user.username} can see devices from other users`);
        hasSecurityIssue = true;
      }
    }
    
    if (issues.length > 0) {
      console.log('❌ ISSUES FOUND:\n');
      issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
      console.log('\n🔧 FIX:');
      console.log('   1. Open Railway Dashboard → PostgreSQL → Data → Query');
      console.log('   2. Run: itam-saas/Agent/migrations/FIX-DEVICE-VISIBILITY-RUN-ON-RAILWAY.sql');
      console.log('   3. Restart backend server on Railway\n');
    } else {
      console.log('✅ All checks passed!\n');
      console.log('Row-Level Security is working correctly:');
      console.log('  • Users see only their devices');
      console.log('  • Admins see all devices');
      console.log('  • Unauthenticated requests return 0 rows\n');
    }
    
    await pool.end();
    process.exit(issues.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

diagnoseVisibility();
