import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Running asset category migration...');
    
    const migrationPath = join(__dirname, 'add-asset-category.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Asset category migration completed successfully!');
    console.log('');
    console.log('📋 Migration Summary:');
    console.log('  - Added category column to assets table');
    console.log('  - Updated existing assets with default categories');
    console.log('  - Created index for category filtering');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
