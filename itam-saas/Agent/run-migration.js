import pkg from 'pg';
const { Pool } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function runMigration() {
  try {
    console.log('🔄 Running usage tracking migration...');
    
    const migrationPath = join(__dirname, 'migrations', 'add-usage-tracking.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    
    await pool.query(sql);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('devices', 'device_usage', 'installed_apps', 'device_heartbeats')
      ORDER BY table_name
    `);
    
    console.log('\n📊 Created tables:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
