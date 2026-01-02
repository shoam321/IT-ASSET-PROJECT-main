const pg = require('pg');
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function testAll() {
  console.log('🔍 Testing all critical queries...\n');

  const tests = [
    { name: 'audit_logs', query: 'SELECT COUNT(*) FROM audit_logs' },
    { name: 'recent_alerts view', query: 'SELECT * FROM recent_alerts LIMIT 1' },
    { name: 'alert_statistics view', query: 'SELECT * FROM alert_statistics' },
    { name: 'payments query', query: `SELECT id, paypal_order_id as order_id, amount as amount_cents FROM payments LIMIT 1` },
    { name: 'auth_users', query: 'SELECT id, username, onboarding_completed FROM auth_users LIMIT 1' },
    { name: 'organizations', query: 'SELECT id, name FROM organizations LIMIT 1' },
    { name: 'assets', query: 'SELECT id, name FROM assets LIMIT 1' },
    { name: 'devices', query: 'SELECT id, device_id, hostname FROM devices LIMIT 1' },
    { name: 'security_alerts', query: 'SELECT id, app_name, severity FROM security_alerts LIMIT 1' },
    { name: 'forbidden_apps', query: 'SELECT id, app_name FROM forbidden_apps LIMIT 1' },
    { name: 'subscriptions', query: 'SELECT id, user_id, status FROM subscriptions LIMIT 1' },
  ];

  for (const t of tests) {
    try {
      const r = await pool.query(t.query);
      console.log(`✅ ${t.name}: OK (${r.rows.length} rows)`);
    } catch (e) {
      console.log(`❌ ${t.name}: ${e.message}`);
    }
  }

  console.log('\n✅ All tests complete');
  await pool.end();
}

testAll();
