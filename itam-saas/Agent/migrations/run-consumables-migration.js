import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const connectionString = process.env.DATABASE_URL_OWNER || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ No DATABASE_URL or DATABASE_URL_OWNER found in env');
  console.error('   Set one of them and re-run the migration.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('🔄 Running Consumables migration...');
    const sql = readFileSync(join(__dirname, 'add-consumables.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ Consumables migration completed successfully!');
    console.log('    - Created consumables and consumable_transactions tables');
    console.log('    - Added indexes and enabled RLS with policies');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (String(error.message).toLowerCase().includes('permission denied')) {
      console.error('ℹ️ Tip: Use an owner connection string via DATABASE_URL_OWNER for migrations that create tables/policies.');
      console.error('   Example: set DATABASE_URL_OWNER in Railway to the direct admin URL and re-run this script.');
    }
    await pool.end();
    process.exit(1);
  }
}

runMigration();
