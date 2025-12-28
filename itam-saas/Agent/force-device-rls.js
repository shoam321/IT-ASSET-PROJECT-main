import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function fixDeviceRLS() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n🔧 Fixing devices RLS...\n');
    
    // Force RLS to apply even for table owner
    await pool.query('ALTER TABLE devices FORCE ROW LEVEL SECURITY');
    console.log('✅ Forced RLS on devices table');
    
    // Do the same for device_usage
    await pool.query('ALTER TABLE device_usage FORCE ROW LEVEL SECURITY');
    console.log('✅ Forced RLS on device_usage table');
    
    console.log('\n✅ RLS now enforced for all users including table owner!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixDeviceRLS();
