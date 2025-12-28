import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function checkBothTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('\n📋 Checking "assets" (lowercase):');
    const res1 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'assets' 
      ORDER BY ordinal_position
    `);
    res1.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    
    console.log('\n📋 Checking "Assets" (capitalized):');
    const res2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Assets' 
      ORDER BY ordinal_position
    `);
    res2.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    
    console.log('\n📋 Checking "licenses" (lowercase):');
    const res3 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'licenses' 
      ORDER BY ordinal_position
    `);
    res3.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    
    console.log('\n📋 Checking "Licenses" (capitalized):');
    const res4 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Licenses' 
      ORDER BY ordinal_position
    `);
    res4.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkBothTables();
