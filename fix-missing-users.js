// Fix missing users in auth_users table
import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function fixMissingUsers() {
  await client.connect();
  console.log('Connected to database');
  
  // Check current users
  const users = await client.query('SELECT id, username, email, role FROM auth_users ORDER BY id');
  console.log('\nCurrent users in auth_users:');
  users.rows.forEach(u => console.log(`  ID ${u.id}: ${u.username} (${u.email}) [${u.role}]`));
  
  // Get max ID to understand sequence
  const maxId = await client.query('SELECT MAX(id) as max_id FROM auth_users');
  console.log('\nMax user ID:', maxId.rows[0].max_id);
  
  // Check sequence value
  const seq = await client.query("SELECT last_value FROM auth_users_id_seq");
  console.log('Sequence last_value:', seq.rows[0].last_value);
  
  // Users that need to be created (IDs 1-10 that are missing)
  const existingIds = new Set(users.rows.map(u => u.id));
  const missingIds = [];
  for (let i = 1; i <= 10; i++) {
    if (!existingIds.has(i)) {
      missingIds.push(i);
    }
  }
  
  console.log('\nMissing user IDs (1-10):', missingIds);
  
  // Create placeholder users for missing IDs
  for (const id of missingIds) {
    try {
      await client.query(`
        INSERT INTO auth_users (id, username, email, password_hash, role, is_active, created_at)
        OVERRIDING SYSTEM VALUE
        VALUES ($1, $2, $3, 'placeholder_needs_reset', 'user', true, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [id, `user${id}`, `user${id}@placeholder.local`]);
      console.log(`  Created placeholder user ID ${id}`);
    } catch (err) {
      console.log(`  Could not create user ${id}:`, err.message);
    }
  }
  
  // Ensure sequence is ahead of all existing IDs
  await client.query("SELECT setval('auth_users_id_seq', GREATEST((SELECT MAX(id) FROM auth_users), 10) + 1)");
  console.log('\nSequence updated');
  
  // Verify
  const finalUsers = await client.query('SELECT id, username, email, role FROM auth_users ORDER BY id');
  console.log('\nFinal users in auth_users:');
  finalUsers.rows.forEach(u => console.log(`  ID ${u.id}: ${u.username} (${u.email}) [${u.role}]`));
  
  await client.end();
  console.log('\nDone!');
}

fixMissingUsers().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
