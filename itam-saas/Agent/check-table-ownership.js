import pool from './db.js';

async function checkOwnership() {
  try {
    console.log('Checking table ownership and current user...\n');
    
    const currentUser = await pool.query('SELECT current_user, session_user');
    console.log('Current database user:', currentUser.rows[0]);
    
    const ownership = await pool.query(`
      SELECT tablename, tableowner 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename IN ('devices', 'device_usage', 'auth_users')
    `);
    
    console.log('\nTable ownership:');
    console.table(ownership.rows);
    
    const rlsInfo = await pool.query(`
      SELECT 
        tablename,
        rowsecurity as rls_enabled,
        (SELECT relforcerowsecurity FROM pg_class WHERE relname = tablename) as force_rls
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'devices'
    `);
    
    console.log('\nRLS status:');
    console.table(rlsInfo.rows);
    
    console.log('\n🔍 THE PROBLEM:');
    console.log('If tableowner = current_user, then RLS does NOT apply!');
    console.log('PostgreSQL skips RLS for table owners for performance.');
    console.log('\n💡 SOLUTION: Create a separate role for the application\n');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

checkOwnership();
