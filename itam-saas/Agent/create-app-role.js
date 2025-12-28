import pool from './db.js';

async function createAppRole() {
  try {
    console.log('🔧 Creating application role for RLS enforcement\n');
    
    //Step 1: Create new role
    console.log('Step 1: Creating "itam_app" role...');
    try {
      await pool.query("CREATE ROLE itam_app LOGIN PASSWORD 'secure_app_password_2025'");
      console.log('✅ Role created');
    } catch (error) {
      if (error.code === '42710') { // Role already exists
        console.log('⚠️  Role already exists');
      } else {
        throw error;
      }
    }
    
    // Step 2: Grant permissions
    console.log('\nStep 2: Granting permissions...');
    await pool.query('GRANT CONNECT ON DATABASE railway TO itam_app');
    await pool.query('GRANT USAGE ON SCHEMA public TO itam_app');
    await pool.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO itam_app');
    await pool.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO itam_app');
    await pool.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO itam_app');
    console.log('✅ Permissions granted');
    
    // Step 3: Update connection string
    console.log('\nStep 3: Update your .env file DATABASE_URL:');
    console.log('OLD: postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway');
    console.log('NEW: postgresql://itam_app:secure_app_password_2025@caboose.proxy.rlwy.net:31886/railway');
    console.log('\n⚠️  IMPORTANT: Update .env and restart server!\n');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

createAppRole();
