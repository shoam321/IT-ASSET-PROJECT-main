import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('🔄 Running Google SSO migration...');
    
    const sql = readFileSync(join(__dirname, 'add-google-sso.sql'), 'utf8');
    await pool.query(sql);
    
    console.log('✅ Google SSO migration completed successfully!');
    console.log('    - Added google_id column to users');
    console.log('    - Added profile_picture column to users');
    console.log('    - Added auth_provider column to users');
    console.log('    - Created index for Google ID lookups');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
