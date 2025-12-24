import * as authQueries from './authQueries.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Create admin user script
 * Usage: node create-admin.js
 */
async function createAdmin() {
  try {
    console.log('🔧 Creating admin user...\n');

    // Get credentials from command line or use defaults
    const username = process.argv[2] || 'admin';
    const email = process.argv[3] || 'admin@itasset.local';
    const password = process.argv[4] || 'admin123';
    const fullName = process.argv[5] || 'System Administrator';

    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    console.log(`Full Name: ${fullName}`);
    console.log(`Password: ${'*'.repeat(password.length)}\n`);

    const user = await authQueries.createAuthUser(
      username,
      email,
      password,
      fullName,
      'admin'
    );

    console.log('✅ Admin user created successfully!');
    console.log('\nUser Details:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Created: ${user.created_at}\n`);

    console.log('📝 Login credentials:');
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log('\n⚠️  Remember to change the password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    console.log('\n💡 Usage: node create-admin.js [username] [email] [password] [fullName]');
    console.log('   Example: node create-admin.js admin admin@company.com SecurePass123 "John Doe"');
    process.exit(1);
  }
}

createAdmin();
