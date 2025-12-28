import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔄 Running tighten-assets-rls migration...\n');
    
    const sql = readFileSync(join(__dirname, 'migrations', 'fix-devices-rls.sql'), 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('\n📋 RLS policies updated:');
    console.log('  - Assets: Users can only see their own assets (or all if admin)');
    console.log('  - Licenses: Users can only see their own licenses (or all if admin)');
    console.log('  - Unassigned items are hidden from regular users\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
