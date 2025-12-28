import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import pool from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Running user-asset-ownership migration...');
    
    const migrationPath = join(__dirname, 'add-user-asset-ownership.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ User-asset-ownership migration completed successfully!');
    console.log('');
    console.log('📋 Migration Summary:');
    console.log('  - Added user_id column to assets, licenses, contracts tables');
    console.log('  - Enabled Row-Level Security (RLS) on all tables');
    console.log('  - Regular users can only see their own assets and licenses');
    console.log('  - Admins can see and manage everything');
    console.log('  - Contracts are admin-only');
    console.log('  - Users table now has RLS (users see self, admins see all)');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
