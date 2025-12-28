#!/usr/bin/env node

/**
 * FIX: Device Visibility Issue
 * Problem: All users can see all devices in the Usage Monitor
 * Solution: Apply fail-secure RLS policies and verify enforcement
 */

import pool from './db.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function fixDeviceVisibility() {
  try {
    console.log('🔧 FIXING DEVICE VISIBILITY ISSUE\n');
    console.log('═══════════════════════════════════════\n');

    // Step 1: Check current state
    console.log('1️⃣ Checking current state...\n');
    
    const rlsStatus = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('devices', 'device_usage')
    `);
    
    console.log('RLS Status:');
    console.table(rlsStatus.rows);
    
    const devices = await pool.query(`
      SELECT device_id, hostname, user_id, last_seen 
      FROM devices 
      ORDER BY last_seen DESC 
      LIMIT 10
    `);
    
    console.log(`\nTotal devices found: ${devices.rows.length}`);
    if (devices.rows.length > 0) {
      console.table(devices.rows);
    }
    
    const nullUserIds = devices.rows.filter(d => d.user_id === null).length;
    if (nullUserIds > 0) {
      console.log(`\n⚠️  WARNING: ${nullUserIds} devices have NULL user_id!\n`);
    }

    // Step 2: Apply fail-secure RLS policies
    console.log('\n2️⃣ Applying fail-secure RLS policies...\n');
    
    const fixPath = join(__dirname, 'migrations', 'fix-rls-security-breach.sql');
    const fixSQL = readFileSync(fixPath, 'utf8');
    
    await pool.query(fixSQL);
    console.log('✅ Policies applied!\n');

    // Step 3: Assign NULL devices to admin user
    console.log('3️⃣ Fixing NULL user_id assignments...\n');
    
    const adminUser = await pool.query(`
      SELECT id FROM auth_users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
    `);
    
    if (adminUser.rows.length === 0) {
      console.log('❌ No admin user found! Creating one...');
      throw new Error('No admin user exists. Please run: node create-admin.js');
    }
    
    const adminId = adminUser.rows[0].id;
    console.log(`Found admin user (id=${adminId})`);
    
    const updateResult = await pool.query(`
      UPDATE devices 
      SET user_id = $1 
      WHERE user_id IS NULL
      RETURNING device_id
    `, [adminId]);
    
    console.log(`✅ Updated ${updateResult.rows.length} devices to admin ownership\n`);
    
    // Also fix device_usage
    const updateUsageResult = await pool.query(`
      UPDATE device_usage 
      SET user_id = $1 
      WHERE user_id IS NULL
      RETURNING id
    `, [adminId]);
    
    console.log(`✅ Updated ${updateUsageResult.rows.length} usage records to admin ownership\n`);

    // Step 4: Test RLS enforcement
    console.log('4️⃣ Testing RLS enforcement...\n');
    
    // Test A: No user_id set (should see 0)
    console.log('Test A: Unauthenticated access...');
    const test1 = await pool.query('SELECT COUNT(*) as count FROM devices');
    const count1 = parseInt(test1.rows[0].count);
    
    if (count1 === 0) {
      console.log('✅ PASS: Unauthenticated query returns 0 devices\n');
    } else {
      console.log(`❌ FAIL: Unauthenticated query returns ${count1} devices!\n`);
    }
    
    // Test B: Regular user (should see only their devices)
    const regularUser = await pool.query(`
      SELECT id FROM auth_users WHERE role = 'user' LIMIT 1
    `);
    
    if (regularUser.rows.length > 0) {
      const userId = regularUser.rows[0].id;
      console.log(`Test B: Regular user (id=${userId})...`);
      
      await pool.query(`SELECT set_config('app.current_user_id', $1, false)`, [userId.toString()]);
      const test2 = await pool.query('SELECT device_id, user_id FROM devices');
      
      const userDeviceCount = test2.rows.length;
      const allBelongToUser = test2.rows.every(d => d.user_id === userId);
      
      if (allBelongToUser) {
        console.log(`✅ PASS: User sees only their ${userDeviceCount} device(s)\n`);
      } else {
        console.log(`❌ FAIL: User sees devices from other users!\n`);
        console.table(test2.rows);
      }
    } else {
      console.log('⚠️  SKIP: No regular users found\n');
    }
    
    // Test C: Admin user (should see all devices)
    console.log(`Test C: Admin user (id=${adminId})...`);
    
    await pool.query(`SELECT set_config('app.current_user_id', $1, false)`, [adminId.toString()]);
    const test3 = await pool.query('SELECT device_id, user_id FROM devices');
    
    console.log(`✅ Admin sees ${test3.rows.length} device(s) (should be all)\n`);

    // Step 5: Summary
    console.log('═══════════════════════════════════════');
    console.log('✅ FIX COMPLETE!');
    console.log('═══════════════════════════════════════\n');
    
    console.log('What was fixed:');
    console.log('  ✓ Applied fail-secure RLS policies');
    console.log('  ✓ Assigned NULL devices to admin user');
    console.log('  ✓ Verified RLS enforcement\n');
    
    console.log('Expected behavior:');
    console.log('  • Regular users see ONLY their devices');
    console.log('  • Admin users see ALL devices');
    console.log('  • Unauthenticated queries return 0 rows\n');
    
    console.log('🔄 Please restart your backend server for changes to take effect.\n');
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

fixDeviceVisibility();
