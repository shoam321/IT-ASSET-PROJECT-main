import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function debugRLS() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Check current user
    const currentUser = await pool.query('SELECT current_user, session_user');
    console.log('\n📋 Database connection info:');
    console.log(`  Current user: ${currentUser.rows[0].current_user}`);
    console.log(`  Session user: ${currentUser.rows[0].session_user}`);
    
    // Set user ID
    await pool.query("SELECT set_config('app.current_user_id', '7', false)");
    
    // Check if it's set
    const check = await pool.query("SELECT current_setting('app.current_user_id', true) as user_id");
    console.log(`  app.current_user_id: ${check.rows[0].user_id}\n`);
    
    // Test the condition directly
    const test = await pool.query(`
      SELECT 
        current_setting('app.current_user_id', true) as setting_value,
        current_setting('app.current_user_id', true) IS NOT NULL as is_not_null,
        current_setting('app.current_user_id', true) != '' as is_not_empty,
        current_setting('app.current_user_id', true)::integer as as_integer
    `);
    console.log('📋 RLS Condition Test:');
    console.log(test.rows[0]);
    
    // Test query WITH RLS bypassed
    const admin = await pool.query('SELECT COUNT(*) as count FROM devices');
    console.log(`\n📋 Total devices (bypassing RLS): ${admin.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

debugRLS();
