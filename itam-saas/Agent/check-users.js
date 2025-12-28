import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

async function checkUsers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const users = await pool.query(`
      SELECT id, username, email, role 
      FROM auth_users 
      ORDER BY id
    `);
    
    console.log('\n📋 All Users:');
    users.rows.forEach(u => {
      console.log(`  - ID: ${u.id}, Username: ${u.username}, Email: ${u.email}, Role: ${u.role}`);
    });
    
    console.log('\n📋 Devices by User:');
    const devicesByUser = await pool.query(`
      SELECT user_id, COUNT(*) as count
      FROM devices
      GROUP BY user_id
      ORDER BY user_id
    `);
    devicesByUser.rows.forEach(d => {
      console.log(`  - User ID ${d.user_id}: ${d.count} devices`);
    });
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsers();
