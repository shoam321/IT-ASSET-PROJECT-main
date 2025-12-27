import pool from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Running digital receipts migration...');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'add-receipts.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Execute migration
    await pool.query(sql);

    console.log('✅ Digital receipts migration completed successfully!');
    console.log('   - Created receipts table');
    console.log('   - Added indexes for performance');
    console.log('   - Enabled Row-Level Security');
    console.log('   - Created security policies');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
