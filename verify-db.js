// Quick database verification
import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  await client.connect();
  
  // Check users
  const users = await client.query('SELECT id, username, email, role FROM auth_users ORDER BY id');
  console.log('Users in database:');
  users.rows.forEach(u => console.log(`  ID ${u.id}: ${u.username} (${u.email}) [${u.role}]`));
  
  // Check category column
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'assets' AND column_name = 'category'
  `);
  console.log('\nCategory column exists:', cols.rows.length > 0);
  
  await client.end();
}

verify();
