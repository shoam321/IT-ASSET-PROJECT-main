import pkg from 'pg';
const { Pool } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

// IMPORTANT:
// This migration must run with a DB role that can ALTER policies on the devices table (table owner).
// In production, use an owner/superuser DATABASE_URL (NOT the restricted itam_app role).
const connectionString = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL (or DATABASE_OWNER_URL)');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    console.log('🔄 Running devices ownership-claim RLS migration...');

    const migrationPath = join(__dirname, 'fix-devices-ownership-claim.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch {}
  }
}

run();
