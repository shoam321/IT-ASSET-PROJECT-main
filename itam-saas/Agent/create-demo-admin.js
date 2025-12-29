import bcrypt from 'bcryptjs';
import pkg from 'pg';
const { Pool } = pkg;

/**
 * Create demo admin account
 * Username: admin
 * Password: SecureAdmin2025
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createDemoAdmin() {
  try {
    console.log('🔐 Creating demo admin account...');
    
    const username = 'admin';
    const password = 'SecureAdmin2025';
    const email = 'admin@itasset.local';
    const fullName = 'Demo Administrator';
    
    // Generate bcrypt hash with salt rounds 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Check if user already exists
    const checkResult = await pool.query(
      'SELECT id FROM auth_users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️  User already exists. Updating password...');
      await pool.query(
        `UPDATE auth_users 
         SET password_hash = $1, role = 'admin', is_active = true, updated_at = NOW()
         WHERE username = $2 OR email = $3`,
        [passwordHash, username, email]
      );
      console.log('✅ Admin password updated successfully');
    } else {
      // Insert new admin user
      const result = await pool.query(
        `INSERT INTO auth_users (username, email, password_hash, full_name, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'admin', true, NOW(), NOW())
         RETURNING id, username, email, role`,
        [username, email, passwordHash, fullName]
      );
      
      console.log('✅ Demo admin account created successfully:');
      console.log(result.rows[0]);
    }
    
    console.log('\n📋 Demo Credentials:');
    console.log('   Username: admin');
    console.log('   Password: SecureAdmin2025');
    console.log('   Email: admin@itasset.local');
    
  } catch (error) {
    console.error('❌ Error creating demo admin:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createDemoAdmin();
