import pool from './db.js';

const result = await pool.query(`
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'users' 
  ORDER BY ordinal_position
`);

console.log('Users table columns:');
console.log(result.rows.map(r => r.column_name).join(', '));

await pool.end();
