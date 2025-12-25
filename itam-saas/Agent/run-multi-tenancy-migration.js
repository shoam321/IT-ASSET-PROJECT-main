// Run Multi-Tenancy Migration
import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Running multi-tenancy migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', 'add-multi-tenancy.sql'),
      'utf8'
    );
    
    await pool.query(migrationSQL);
    
    console.log('✅ Multi-tenancy migration completed successfully!');
    console.log('   - Added role column to users');
    console.log('   - Added user_id to devices and device_usage');
    console.log('   - Enabled Row-Level Security');
    console.log('   - Created security policies');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
