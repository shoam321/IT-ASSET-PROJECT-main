/**
 * Run Audit Trail Migration
 * Creates audit_logs table for tracking all system changes
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  console.log('🔄 Running audit trail migration...');
  
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'add-audit-logs.sql'),
      'utf-8'
    );
    
    await pool.query(sql);
    
    console.log('✅ Audit trail migration completed successfully!');
    console.log('   - Created audit_logs table');
    console.log('   - Added indexes for performance');
    console.log('   - Enabled Row-Level Security');
    console.log('   - Created security policies');
    
  } catch (error) {
    if (error.code === '42P07') {
      console.log('✅ Audit logs table already exists');
    } else {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

runMigration();
