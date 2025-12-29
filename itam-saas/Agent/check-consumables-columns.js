import pool from './db.js';

const result = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'consumables' 
  ORDER BY ordinal_position
`);

console.log('Consumables table columns:');
result.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));

await pool.end();
