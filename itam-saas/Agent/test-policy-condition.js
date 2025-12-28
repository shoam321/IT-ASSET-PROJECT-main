import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function testPolicyCondition() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Set as user 7
    await pool.query("SELECT set_config('app.current_user_id', '7', false)");
    
    // Test the WHERE condition manually
    const test = await pool.query(`
      SELECT 
        d.id,
        d.user_id,
        (d.user_id = current_setting('app.current_user_id', true)::integer) as user_match,
        EXISTS (
          SELECT 1 FROM auth_users
          WHERE id = current_setting('app.current_user_id', true)::integer
          AND role = 'admin'
        ) as is_admin,
        (
          d.user_id = current_setting('app.current_user_id', true)::integer
          OR EXISTS (
            SELECT 1 FROM auth_users
            WHERE id = current_setting('app.current_user_id', true)::integer
            AND role = 'admin'
          )
        ) as should_see
      FROM devices d
    `);
    
    console.log('\n📋 RLS Policy Evaluation for User ID 7:\n');
    test.rows.forEach(r => {
      console.log(`Device ID ${r.id} (user_id: ${r.user_id})`);
      console.log(`  User match: ${r.user_match}`);
      console.log(`  Is admin: ${r.is_admin}`);
      console.log(`  Should see: ${r.should_see}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testPolicyCondition();
