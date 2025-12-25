import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function runMigration() {
  console.log('🔄 Connecting to database...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Read migration file
    const sql = fs.readFileSync('./migrations/add-forbidden-apps.sql', 'utf8');
    
    console.log('🔄 Running migration...');
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Created:');
    console.log('  - forbidden_apps table');
    console.log('  - security_alerts table');
    console.log('  - PostgreSQL NOTIFY triggers');
    console.log('  - 7 default forbidden apps');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
