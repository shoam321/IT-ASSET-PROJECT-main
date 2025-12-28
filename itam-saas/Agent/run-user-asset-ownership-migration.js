import pkg from 'pg';
const { Pool } = pkg;
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env relative to this folder so it works regardless of process.cwd().
const envLocalPath = join(__dirname, '.env.local');
const envPath = join(__dirname, '.env');
if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config({ path: envPath });
}

const connectionString = process.env.DATABASE_URL_OWNER || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL (or DATABASE_URL_OWNER).');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function run() {
  const usingOwner = Boolean(process.env.DATABASE_URL_OWNER);
  console.log(`🔄 Running add-user-asset-ownership.sql (using ${usingOwner ? 'DATABASE_URL_OWNER' : 'DATABASE_URL'})`);

  const migrationPath = join(__dirname, 'migrations', 'add-user-asset-ownership.sql');
  const sql = readFileSync(migrationPath, 'utf8');

  try {
    await pool.query(sql);
    console.log('✅ Migration completed successfully');
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('❌ Migration failed:', msg);

    if (!usingOwner) {
      console.error('ℹ️ Tip: This migration needs table owner privileges (ALTER TABLE / DROP POLICY). Set DATABASE_URL_OWNER to an owner/superuser connection string and re-run.');
    }

    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

run();
