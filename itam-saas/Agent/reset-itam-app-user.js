import pkg from 'pg';
const { Client } = pkg;

async function resetItamAppUser() {
  // Connect as postgres superuser
  const client = new Client({
    connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway'
  });

  try {
    await client.connect();
    console.log('✅ Connected to Railway database as postgres');

    // Change password for existing user
    await client.query(`ALTER USER itam_app WITH PASSWORD 'secure_app_password_2025';`);
    console.log('✅ Updated itam_app user password');

    // Ensure all privileges are granted
    await client.query(`GRANT ALL PRIVILEGES ON DATABASE railway TO itam_app;`);
    console.log('✅ Granted database privileges');

    // Grant privileges on all tables in public schema
    await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO itam_app;`);
    console.log('✅ Granted table privileges');

    // Grant privileges on all sequences
    await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO itam_app;`);
    console.log('✅ Granted sequence privileges');

    // Set default privileges for future objects
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO itam_app;`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO itam_app;`);
    console.log('✅ Set default privileges for future objects');

    console.log('\n🎉 SUCCESS! itam_app user is ready with password: secure_app_password_2025');
    console.log('\n📝 Your .env DATABASE_URL is now correct:');
    console.log('DATABASE_URL=postgresql://itam_app:secure_app_password_2025@caboose.proxy.rlwy.net:31886/railway');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetItamAppUser();
