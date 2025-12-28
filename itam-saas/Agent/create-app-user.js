import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function createAppUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n🔧 Creating application database user...\n');
    
    // Create app user
    try {
      await pool.query(`CREATE USER itam_app WITH PASSWORD 'itam_app_secure_2025'`);
      console.log('✅ Created user: itam_app');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('ℹ️  User itam_app already exists');
      } else {
        throw e;
      }
    }
    
    // Grant permissions
    await pool.query(`GRANT CONNECT ON DATABASE railway TO itam_app`);
    await pool.query(`GRANT USAGE ON SCHEMA public TO itam_app`);
    await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO itam_app`);
    await pool.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO itam_app`);
    
    console.log('✅ Granted permissions to itam_app');
    
    console.log('\n📋 New connection string:');
    console.log('postgresql://itam_app:itam_app_secure_2025@caboose.proxy.rlwy.net:31886/railway\n');
    console.log('⚠️  Update this in Railway environment variables!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createAppUser();
