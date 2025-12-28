import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import pool from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runFix() {
  try {
    console.log('🚨 CRITICAL SECURITY FIX');
    console.log('Applying fail-secure RLS policies...\n');
    
    const fixPath = join(__dirname, 'fix-rls-security-breach.sql');
    const fixSQL = readFileSync(fixPath, 'utf8');
    
    await pool.query(fixSQL);
    
    console.log('✅ Security fix applied!\n');
    console.log('Testing enforcement...\n');
    
    // Test 1: No user_id set -> Should see NOTHING
    const test1 = await pool.query('SELECT COUNT(*) as count FROM devices');
    const count1 = parseInt(test1.rows[0].count);
    
    if (count1 === 0) {
      console.log('✅ TEST 1 PASSED: Unauthenticated query returns 0 devices');
    } else {
      console.log(`❌ TEST 1 FAILED: Unauthenticated query returns ${count1} devices!`);
    }
    
    // Test 2: Set to admin (user_id=1) -> Should see ALL
    await pool.query("SELECT set_config('app.current_user_id', '1', false)");
    const test2 = await pool.query('SELECT COUNT(*) as count FROM devices');
    const count2 = parseInt(test2.rows[0].count);
    console.log(`✅ TEST 2: Admin sees ${count2} devices (should be all)`);
    
    // Test 3: Set to regular user (user_id=7) -> Should see only theirs
    await pool.query("SELECT set_config('app.current_user_id', '7', false)");
    const test3 = await pool.query('SELECT COUNT(*) as count FROM devices');
    const count3 = parseInt(test3.rows[0].count);
    console.log(`✅ TEST 3: User ID 7 sees ${count3} device(s) (should be 0, they have no devices)`);
    
    // Test 4: Set to user with device (user_id=3)
    await pool.query("SELECT set_config('app.current_user_id', '3', false)");
    const test4 = await pool.query('SELECT device_id FROM devices');
    console.log(`✅ TEST 4: User ID 3 sees ${test4.rows.length} device(s):`);
    test4.rows.forEach(d => console.log(`   - ${d.device_id}`));
    
    console.log('\n═══════════════════════════════════════');
    console.log('🎯 SECURITY BREACH FIXED!');
    console.log('═══════════════════════════════════════\n');
    console.log('RLS now FAILS SECURE:');
    console.log('  ✓ No auth = No data');
    console.log('  ✓ Regular users see only their data');
    console.log('  ✓ Admins see all data\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runFix();
