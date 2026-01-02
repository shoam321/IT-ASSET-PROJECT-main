// Fix missing columns and user for agent
import pg from 'pg';

const DATABASE_URL = 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway';

async function fix() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Add missing category column to assets
    console.log('📋 Step 1: Adding missing columns to assets table...');
    await client.query(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS category VARCHAR(255)`);
    console.log('   ✅ Added category column');

    // 2. Check current users
    console.log('\n📋 Step 2: Checking current users...');
    const usersBefore = await client.query('SELECT id, username, email, role FROM auth_users ORDER BY id');
    console.log('   Current users:', usersBefore.rows.length === 0 ? 'None' : '');
    usersBefore.rows.forEach(u => console.log(`   - ID ${u.id}: ${u.username} (${u.email}) [${u.role}]`));

    // 3. Create the user that the agent is trying to use (id=4)
    console.log('\n📋 Step 3: Creating agent user (id=4)...');
    
    // We need to insert with specific IDs, so we'll use OVERRIDING SYSTEM VALUE
    const insertResult = await client.query(`
      INSERT INTO auth_users (id, username, email, password_hash, full_name, role, is_active)
      OVERRIDING SYSTEM VALUE
      VALUES (4, 'shoam', 'shoam@example.com', '$2b$10$placeholder.needs.password.reset.via.forgot.password', 'Shoam (Agent User)', 'admin', true)
      ON CONFLICT (id) DO UPDATE SET 
        username = EXCLUDED.username,
        is_active = true
      RETURNING id, username, email
    `);
    console.log('   ✅ Created/updated user:', insertResult.rows[0]);

    // Reset the sequence to avoid conflicts
    await client.query(`SELECT setval('auth_users_id_seq', GREATEST((SELECT MAX(id) FROM auth_users), 1))`);
    console.log('   ✅ Reset auth_users sequence');

    // 4. Verify the fix
    console.log('\n📋 Step 4: Verification...');
    const usersAfter = await client.query('SELECT id, username, email, role FROM auth_users ORDER BY id');
    console.log('   Users after fix:');
    usersAfter.rows.forEach(u => console.log(`   - ID ${u.id}: ${u.username} (${u.email}) [${u.role}]`));

    // Check assets columns
    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'assets' AND column_name IN ('category', 'category_id', 'location', 'location_id')
    `);
    console.log('\n   Assets columns present:', cols.rows.map(r => r.column_name).join(', '));

    console.log('\n🎉 Database fix complete!');
    console.log('\n⚠️  IMPORTANT: User id=4 needs a password reset!');
    console.log('   Use the "Forgot Password" feature at the frontend to set a new password.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

fix();
