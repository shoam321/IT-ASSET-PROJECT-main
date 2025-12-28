import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function resetPassword() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL  // Using postgres user
  });

  try {
    console.log('\n🔧 Resetting itam_app password...\n');
    
    await pool.query(`ALTER USER itam_app WITH PASSWORD 'itam_app_secure_2025'`);
    console.log('✅ Password reset successfully');
    
    console.log('\n📋 Use this connection string in Railway:');
    console.log('postgresql://itam_app:itam_app_secure_2025@caboose.proxy.rlwy.net:31886/railway\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

resetPassword();
