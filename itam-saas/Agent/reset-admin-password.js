import bcrypt from 'bcryptjs';
import pool from './db.js';

/**
 * Reset admin password
 * Usage: node reset-admin-password.js [newPassword]
 */
async function resetAdminPassword() {
  try {
    const newPassword = process.argv[2] || 'admin123';
    
    console.log('🔧 Resetting admin password...\n');

    // Find admin user
    const userResult = await pool.query(
      "SELECT id, username, email FROM auth_users WHERE username = 'admin' AND role = 'admin' LIMIT 1"
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Admin user not found!');
      process.exit(1);
    }

    const admin = userResult.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE auth_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, admin.id]
    );

    console.log('✅ Admin password reset successfully!');
    console.log('\nAdmin Details:');
    console.log(`  ID: ${admin.id}`);
    console.log(`  Username: ${admin.username}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  New Password: ${newPassword}`);
    console.log('\n🔑 You can now login with:');
    console.log(`  Username: ${admin.username}`);
    console.log(`  Password: ${newPassword}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
    console.log('\n💡 Usage: node reset-admin-password.js [newPassword]');
    console.log('   Example: node reset-admin-password.js MyNewPass123');
    process.exit(1);
  }
}

resetAdminPassword();
