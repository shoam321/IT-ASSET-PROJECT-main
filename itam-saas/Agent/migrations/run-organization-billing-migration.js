// Run organization billing migration
import pool from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Running organization billing migration...');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'add-organization-billing.sql'),
      'utf8'
    );

    await pool.query(migrationSQL);

    console.log('✅ Organization billing migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
