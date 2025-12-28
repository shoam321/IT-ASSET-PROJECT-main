import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import pool from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Running multi-tenancy migration...');
    console.log('   This enables Row-Level Security for user data isolation\n');
    
    const migrationPath = join(__dirname, 'add-multi-tenancy.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Multi-tenancy migration completed successfully!\n');
    console.log('📋 What was done:');
    console.log('  ✓ Added user_id column to devices and device_usage tables');
    console.log('  ✓ Enabled Row-Level Security (RLS)');
    console.log('  ✓ Created policies: users see only their data, admins see all');
    console.log('  ✓ Linked existing devices to admin user\n');
    console.log('🎯 Result: Users will now only see their own devices!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Migration may have already been run.');
      console.log('   RLS is likely already enabled.\n');
      process.exit(0);
    }
    process.exit(1);
  }
}

runMigration();
