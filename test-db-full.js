const pg = require('pg');
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function testAllQueries() {
  console.log('🔍 Testing all critical database queries...\n');

  const tests = [
    // Auth & Users
    { name: 'auth_users', query: 'SELECT id, username, email, onboarding_completed, trial_started_at, trial_ends_at FROM auth_users LIMIT 1' },
    { name: 'organizations', query: 'SELECT id, name, created_at FROM organizations LIMIT 1' },
    
    // Assets & Inventory
    { name: 'assets', query: 'SELECT id, asset_tag, asset_type, manufacturer, model, status FROM assets LIMIT 1' },
    { name: 'licenses', query: 'SELECT id, software_name, license_key FROM licenses LIMIT 1' },
    { name: 'contracts', query: 'SELECT id, contract_name FROM contracts LIMIT 1' },
    
    // Agent & Monitoring
    { name: 'devices', query: 'SELECT id, device_id, hostname, os_name FROM devices LIMIT 1' },
    { name: 'device_usage', query: 'SELECT id, device_id FROM device_usage LIMIT 1' },
    { name: 'app_usage', query: 'SELECT id, device_id FROM app_usage LIMIT 1' },
    
    // Security
    { name: 'forbidden_apps', query: 'SELECT id, name, severity FROM forbidden_apps LIMIT 1' },
    { name: 'security_alerts', query: 'SELECT id, device_id, app_name, severity, status FROM security_alerts LIMIT 1' },
    { name: 'recent_alerts (view)', query: 'SELECT * FROM recent_alerts LIMIT 1' },
    { name: 'alert_statistics (view)', query: 'SELECT * FROM alert_statistics' },
    
    // Payments & Billing
    { name: 'payments', query: 'SELECT id, paypal_order_id, amount, status FROM payments LIMIT 1' },
    { name: 'subscriptions', query: 'SELECT id, user_id, plan_type, status FROM subscriptions LIMIT 1' },
    
    // Audit
    { name: 'audit_logs', query: 'SELECT id, table_name, action FROM audit_logs LIMIT 1' },
    
    // Consumables
    { name: 'consumables', query: 'SELECT id, name FROM consumables LIMIT 1' },
    { name: 'consumable_stock', query: 'SELECT id, consumable_id FROM consumable_stock LIMIT 1' },
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      const r = await pool.query(t.query);
      console.log(`✅ ${t.name}: OK (${r.rows.length} rows)`);
      passed++;
    } catch (e) {
      console.log(`❌ ${t.name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  await pool.end();
}

testAllQueries();
