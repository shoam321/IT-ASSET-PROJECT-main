import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envLocalPath = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config({ path: envPath });
}

const { Pool } = pg;

// Prefer an owner/superuser connection when available so DDL succeeds.
const connectionString = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL (or DATABASE_OWNER_URL)');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('railway') ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running organizations migration...');

    const migrationPath = path.join(__dirname, 'migrations', 'add-organizations.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✅ Organizations migration completed successfully!');
    console.log('\nTables created:');
    console.log('  - organizations');
    console.log('  - organization_invitations');
    console.log('\nColumns added to auth_users:');
    console.log('  - organization_id');
    console.log('  - org_role');
    console.log('\nRLS policies applied for multi-tenant security.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    if (error.code === '42501') {
      console.error('\nThe database role in use cannot create/alter objects.');
      console.error('Set DATABASE_OWNER_URL to a schema owner/superuser and rerun.');
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
