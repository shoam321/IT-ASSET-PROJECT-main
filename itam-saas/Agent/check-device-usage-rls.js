import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkRLS() {
  const client = await pool.connect();
  try {
    console.log('\n=== Checking device_usage RLS policies ===');
    const policies = await client.query(`
      SELECT policyname, cmd, with_check, qual
      FROM pg_policies 
      WHERE tablename = 'device_usage'
      ORDER BY cmd, policyname
    `);
    console.log('Policies:');
    policies.rows.forEach(p => {
      console.log(`  ${p.policyname} (${p.cmd}):`);
      if (p.with_check) console.log(`    WITH CHECK: ${p.with_check}`);
      if (p.qual) console.log(`    USING: ${p.qual}`);
    });
    
    console.log('\n=== Checking devices for user 7 ===');
    const devices = await client.query(`
      SELECT device_id, user_id, hostname
      FROM devices 
      WHERE user_id = 7
      LIMIT 5
    `);
    console.log('Devices for user 7:', devices.rows);
    
    console.log('\n=== Testing RLS context ===');
    await client.query("SET app.current_user_id = '7'");
    const currentUser = await client.query("SELECT current_setting('app.current_user_id', true) as user_id");
    console.log('Current user ID:', currentUser.rows[0].user_id);
    
    // Try a test insert
    console.log('\n=== Attempting test insert ===');
    try {
      const result = await client.query(`
        INSERT INTO device_usage (device_id, app_name, window_title, duration, timestamp, user_id)
        VALUES ('LT-SHOAM-TA::7', 'Test App', 'Test Window', 100, NOW(), 7)
        RETURNING *
      `);
      console.log('✅ Insert succeeded:', result.rows[0]);
      
      // Clean up
      await client.query("DELETE FROM device_usage WHERE app_name = 'Test App' AND device_id = 'LT-SHOAM-TA::7'");
    } catch (err) {
      console.log('❌ Insert failed:', err.message);
      console.log('Error code:', err.code);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkRLS().catch(console.error);
