import pool from './itam-saas/Agent/db.js';

async function upgradeToAdmin() {
  try {
    console.log('🔧 Upgrading user to admin role...\n');
    
    // Update the user role to admin
    const result = await pool.query(
      `UPDATE auth_users 
       SET role = 'admin' 
       WHERE email = 'shoamtaitler@gmail.com' 
       RETURNING id, username, email, role`
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User upgraded successfully:');
    console.table(result.rows);
    
    console.log('\n⚠️  IMPORTANT: You need to log out and log back in for the role change to take effect.');
    console.log('   The new role will be included in your new JWT token.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

upgradeToAdmin();
