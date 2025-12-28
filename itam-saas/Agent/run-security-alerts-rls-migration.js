// Run Security Alerts RLS Migration
import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Enabling RLS for security alerts...');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', 'add-security-alerts-rls.sql'),
      'utf8'
    );

    await pool.query(migrationSQL);

    console.log('✅ Security alerts RLS enabled successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
