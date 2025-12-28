import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function checkDevicePolicies() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n📋 Checking devices table RLS policies:\n');
    
    const policies = await pool.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'devices'
      ORDER BY policyname
    `);
    
    if (policies.rows.length === 0) {
      console.log('❌ NO POLICIES FOUND on devices table!');
      console.log('   This is why everyone sees all devices!\n');
    } else {
      policies.rows.forEach(p => {
        console.log(`Policy: ${p.policyname}`);
        console.log(`  Command: ${p.cmd}`);
        console.log(`  Using: ${p.qual}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDevicePolicies();
