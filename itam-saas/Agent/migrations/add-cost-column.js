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
    console.log('🔧 Running migration: Add missing columns to assets and contracts tables...');
    
    // Add cost column to assets if it doesn't exist
    await pool.query(`
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS cost DECIMAL(10, 2) DEFAULT 0;
    `);
    console.log('✅ Added cost column to assets');
    
    // Add discovered column to assets if it doesn't exist
    await pool.query(`
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS discovered BOOLEAN DEFAULT false;
    `);
    console.log('✅ Added discovered column to assets');
    
    // Add missing columns to contracts
    await pool.query(`
      ALTER TABLE contracts 
      ADD COLUMN IF NOT EXISTS contract_value DECIMAL(10, 2) DEFAULT 0;
    `);
    console.log('✅ Added contract_value column to contracts');
    
    await pool.query(`
      ALTER TABLE contracts 
      ADD COLUMN IF NOT EXISTS renewal_date DATE;
    `);
    console.log('✅ Added renewal_date column to contracts');
    
    await pool.query(`
      ALTER TABLE contracts 
      ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);
    `);
    console.log('✅ Added contact_person column to contracts');
    
    await pool.query(`
      ALTER TABLE contracts 
      ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
    `);
    console.log('✅ Added contact_email column to contracts');
    
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

addCostColumn();
