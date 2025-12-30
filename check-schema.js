// Check database schema
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  const client = await pool.connect();
  
  try {
    const tables = ['assets', 'licenses', 'consumables', 'contracts'];
    
    for (const table of tables) {
      const result = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      console.log(`\n${table.toUpperCase()} table columns:`);
      if (result.rows.length === 0) {
        console.log(`  Table does not exist`);
      } else {
        result.rows.forEach(row => {
          console.log(`  - ${row.column_name}: ${row.data_type}`);
        });
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema().catch(console.error);
