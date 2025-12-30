const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkUsers() {
  try {
    // Check columns
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('Users table columns:');
    cols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
    
    // Count users
    const counts = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status != 'active') as inactive
      FROM users
    `);
    
    console.log('\nUser counts:');
    console.log(`  Total: ${counts.rows[0].total}`);
    console.log(`  Active: ${counts.rows[0].active}`);
    console.log(`  Inactive: ${counts.rows[0].inactive}`);
    
    // Show sample data
    const sample = await pool.query('SELECT id, username, email, status FROM users LIMIT 5');
    console.log('\nSample users:');
    sample.rows.forEach(u => console.log(`  ${u.id}: ${u.username} (${u.email}) - Status: ${u.status}`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsers();
