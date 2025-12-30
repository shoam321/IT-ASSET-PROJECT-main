import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Missing DATABASE_URL (or DATABASE_OWNER_URL)');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function run() {
  try {
    console.log('🔄 Running payments migration...');
    const sql = readFileSync(join(__dirname, 'add-payments.sql'), 'utf8');
    await pool.query(sql);
    console.log('✅ Payments migration completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (String(error.message || '').toLowerCase().includes('permission denied')) {
      console.error('ℹ️ Tip: use DATABASE_OWNER_URL with a role that can create tables/policies.');
    }
    process.exit(1);
  } finally {
    try { await pool.end(); } catch {}
  }
}

run();
