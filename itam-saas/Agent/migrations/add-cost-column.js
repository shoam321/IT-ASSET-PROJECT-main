import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addCostColumn() {
  try {
    console.log('🔧 Running migration: Add missing columns to assets table...');
    
    // Add cost column if it doesn't exist
    await pool.query(`
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS cost DECIMAL(10, 2) DEFAULT 0;
    `);
    console.log('✅ Added cost column');
    
    // Add discovered column if it doesn't exist
    await pool.query(`
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS discovered BOOLEAN DEFAULT false;
    `);
    console.log('✅ Added discovered column');
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

addCostColumn();
