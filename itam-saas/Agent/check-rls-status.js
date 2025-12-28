import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function checkRLSStatus() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const res = await pool.query(`
      SELECT 
        tablename,
        rowsecurity as rls_enabled,
        (SELECT relforcerowsecurity FROM pg_class WHERE relname = tablename) as force_rls
      FROM pg_tables
      WHERE tablename IN ('devices', 'device_usage', 'assets', 'licenses')
      AND schemaname = 'public'
    `);
    
    console.log('\n📋 RLS Status:\n');
    res.rows.forEach(r => {
      console.log(`Table: ${r.tablename}`);
      console.log(`  RLS Enabled: ${r.rls_enabled}`);
      console.log(`  Force RLS: ${r.force_rls}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkRLSStatus();
