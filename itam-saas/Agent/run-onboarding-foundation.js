// Applies the onboarding foundation migration using DATABASE_OWNER_URL (preferred) or DATABASE_URL.
// Run: node itam-saas/Agent/run-onboarding-foundation.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envLocalPath = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config({ path: envPath });
}

const sqlPath = path.join(__dirname, 'migrations', 'add-onboarding-foundation.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const dsn = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;
if (!dsn) {
  console.error('❌ DATABASE_OWNER_URL or DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: dsn, ssl: dsn.includes('railway') ? { rejectUnauthorized: false } : false });

(async () => {
  const client = await pool.connect();
  try {
    console.log('🔧 Applying onboarding foundation migration...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Onboarding foundation applied successfully');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('❌ Failed to apply onboarding foundation:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
