import pool from './itam-saas/Agent/db.js';

async function upgradeAllToAdmin() {
  try {
    console.log('🔧 Upgrading all users to admin role...\n');
    
    const updateResult = await pool.query(
      `UPDATE auth_users 
       SET role = 'admin' 
       WHERE role IS DISTINCT FROM 'admin'
       RETURNING id, username, email, role`
    );

    await pool.query(`ALTER TABLE auth_users ALTER COLUMN role SET DEFAULT 'admin';`);

    if (updateResult.rows.length === 0) {
      console.log('ℹ️ All users are already admins.');
    } else {
      console.log('✅ Users upgraded successfully:');
      console.table(updateResult.rows);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

upgradeAllToAdmin();
