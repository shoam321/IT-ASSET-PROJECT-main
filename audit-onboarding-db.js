// Audit database for onboarding flow requirements
import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function audit() {
  await client.connect();
  console.log('🔍 DATABASE AUDIT FOR ONBOARDING FLOW\n');
  console.log('='.repeat(60));

  // 1. Check auth_users table
  console.log('\n📋 AUTH_USERS TABLE:');
  const authCols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'auth_users' 
    ORDER BY ordinal_position
  `);
  if (authCols.rows.length > 0) {
    authCols.rows.forEach(c => console.log(`  ✓ ${c.column_name} (${c.data_type})`));
  } else {
    console.log('  ❌ TABLE MISSING');
  }

  // Check what's MISSING in auth_users
  const neededAuthCols = ['first_name', 'last_name', 'trial_started_at', 'trial_ends_at', 'onboarding_completed'];
  const existingAuthCols = authCols.rows.map(r => r.column_name);
  const missingAuthCols = neededAuthCols.filter(c => !existingAuthCols.includes(c));
  if (missingAuthCols.length > 0) {
    console.log('\n  ⚠️  MISSING COLUMNS:');
    missingAuthCols.forEach(c => console.log(`    - ${c}`));
  }

  // 2. Check organizations table
  console.log('\n📋 ORGANIZATIONS TABLE:');
  const orgCols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_name = 'organizations' 
    ORDER BY ordinal_position
  `);
  if (orgCols.rows.length > 0) {
    orgCols.rows.forEach(c => console.log(`  ✓ ${c.column_name} (${c.data_type})`));
  } else {
    console.log('  ❌ TABLE MISSING');
  }

  // 3. Check subscriptions table
  console.log('\n📋 SUBSCRIPTIONS TABLE:');
  const subCols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_name = 'subscriptions' 
    ORDER BY ordinal_position
  `);
  if (subCols.rows.length > 0) {
    subCols.rows.forEach(c => console.log(`  ✓ ${c.column_name} (${c.data_type})`));
  } else {
    console.log('  ❌ TABLE MISSING');
  }

  // 4. Check payments table
  console.log('\n📋 PAYMENTS TABLE:');
  const payCols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_name = 'payments' 
    ORDER BY ordinal_position
  `);
  if (payCols.rows.length > 0) {
    payCols.rows.forEach(c => console.log(`  ✓ ${c.column_name} (${c.data_type})`));
  } else {
    console.log('  ❌ TABLE MISSING');
  }

  // 5. Check assets table
  console.log('\n📋 ASSETS TABLE:');
  const assetCols = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_name = 'assets' 
    ORDER BY ordinal_position
  `);
  if (assetCols.rows.length > 0) {
    console.log(`  ✓ ${assetCols.rows.length} columns exist`);
  } else {
    console.log('  ❌ TABLE MISSING');
  }

  // 6. Check foreign key relationships
  console.log('\n🔗 FOREIGN KEY RELATIONSHIPS:');
  const fks = await client.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    ORDER BY tc.table_name
  `);
  fks.rows.forEach(fk => {
    console.log(`  ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY - WHAT\'S NEEDED FOR ONBOARDING:');
  console.log('='.repeat(60));
  
  const issues = [];
  
  if (missingAuthCols.length > 0) {
    issues.push(`Add to auth_users: ${missingAuthCols.join(', ')}`);
  }
  if (subCols.rows.length === 0) {
    issues.push('Create subscriptions table');
  }
  if (payCols.rows.length === 0) {
    issues.push('Create payments table');
  }

  if (issues.length === 0) {
    console.log('\n✅ ALL DATABASE REQUIREMENTS MET!');
  } else {
    console.log('\n⚠️  ITEMS TO FIX:');
    issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  }

  await client.end();
}

audit().catch(e => { console.error(e); process.exit(1); });
