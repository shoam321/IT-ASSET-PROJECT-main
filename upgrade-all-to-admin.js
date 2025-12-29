import pool from './itam-saas/Agent/db.js';

async function upgradeAllToAdmin() {
  try {
    console.log('🔧 Upgrading all users to admin role...\n');
    
    const result = await pool.query(
      `UPDATE auth_users 
       SET role = 'admin' 
       WHERE id IN (1, 3, 4)
       RETURNING id, username, email, role`
    );

    console.log('✅ Users upgraded successfully:');
    console.table(result.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

upgradeAllToAdmin();
