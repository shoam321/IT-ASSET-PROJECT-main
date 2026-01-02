// Add missing columns for onboarding flow
import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function addColumns() {
  await client.connect();
  console.log('🔧 Adding missing columns for onboarding...\n');

  // Add first_name
  try {
    await client.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)`);
    console.log('✅ Added first_name column');
  } catch (e) {
    console.log('⚠️  first_name:', e.message);
  }

  // Add last_name
  try {
    await client.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)`);
    console.log('✅ Added last_name column');
  } catch (e) {
    console.log('⚠️  last_name:', e.message);
  }

  // Add trial_started_at
  try {
    await client.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP`);
    console.log('✅ Added trial_started_at column');
  } catch (e) {
    console.log('⚠️  trial_started_at:', e.message);
  }

  // Add trial_ends_at
  try {
    await client.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP`);
    console.log('✅ Added trial_ends_at column');
  } catch (e) {
    console.log('⚠️  trial_ends_at:', e.message);
  }

  // Verify
  console.log('\n📋 Verifying auth_users columns:');
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'auth_users' 
    ORDER BY ordinal_position
  `);
  cols.rows.forEach(c => console.log(`  ✓ ${c.column_name} (${c.data_type})`));

  await client.end();
  console.log('\n✅ Database ready for onboarding flow!');
}

addColumns().catch(e => { console.error(e); process.exit(1); });
