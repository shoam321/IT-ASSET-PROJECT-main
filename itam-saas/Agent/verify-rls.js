import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function verifyRLS() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n🔍 Verifying RLS Configuration...\n');
    
    // Check if RLS is enabled
    const rlsCheck = await pool.query(`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE tablename IN ('assets', 'licenses')
      AND schemaname = 'public'
    `);
    
    console.log('📋 RLS Status:');
    rlsCheck.rows.forEach(r => {
      const status = r.rowsecurity ? '✅ ENABLED' : '❌ DISABLED';
      console.log(`  - ${r.tablename}: ${status}`);
    });
    
    // Check policies
    const policiesCheck = await pool.query(`
      SELECT tablename, policyname, cmd
      FROM pg_policies
      WHERE tablename IN ('assets', 'licenses')
      ORDER BY tablename, policyname
    `);
    
    console.log('\n📋 Active Policies:');
    policiesCheck.rows.forEach(r => {
      console.log(`  - ${r.tablename}.${r.policyname} (${r.cmd})`);
    });
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyRLS();
