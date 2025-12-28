import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function addUserIdToLicenses() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔄 Adding user_id column to licenses table...\n');
    
    // Check if column already exists
    const checkCol = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'licenses' AND column_name = 'user_id'
    `);
    
    if (checkCol.rows.length > 0) {
      console.log('✅ user_id column already exists in licenses table');
    } else {
      await pool.query(`
        ALTER TABLE licenses 
        ADD COLUMN user_id INTEGER REFERENCES auth_users(id)
      `);
      console.log('✅ Added user_id column to licenses table');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addUserIdToLicenses();
