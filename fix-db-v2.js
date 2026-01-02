const pg = require('pg');
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  try {
    // 1. Add missing columns to audit_logs
    console.log('1️⃣ Fixing audit_logs table...');
    const cols = ['user_id INTEGER', 'username VARCHAR(100)', 'ip_address VARCHAR(50)', 'user_agent TEXT'];
    for (const col of cols) {
      try {
        await pool.query(`ALTER TABLE audit_logs ADD COLUMN ${col}`);
        console.log(`   ✅ Added ${col.split(' ')[0]}`);
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`   ⏭️ ${col.split(' ')[0]} already exists`);
        } else {
          console.log(`   ⚠️ ${col.split(' ')[0]}: ${e.message}`);
        }
      }
    }

    // Create indexes
    try { await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`); } catch(e) {}
    console.log('   ✅ audit_logs ready\n');

    // 2. Create recent_alerts view
    console.log('2️⃣ Creating recent_alerts view...');
    await pool.query(`
      CREATE OR REPLACE VIEW recent_alerts AS
      SELECT 
        sa.id,
        sa.device_id,
        sa.app_name as app_detected,
        sa.severity,
        sa.status,
        sa.created_at,
        d.hostname,
        d.os_name,
        au.username as device_owner
      FROM security_alerts sa
      LEFT JOIN devices d ON sa.device_id = d.device_id
      LEFT JOIN auth_users au ON sa.user_id = au.id
      ORDER BY sa.created_at DESC
      LIMIT 100
    `);
    console.log('   ✅ recent_alerts view created\n');

    // 3. Create alert_statistics view
    console.log('3️⃣ Creating alert_statistics view...');
    await pool.query(`
      CREATE OR REPLACE VIEW alert_statistics AS
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN status = 'New' THEN 1 END) as new_alerts,
        COUNT(CASE WHEN severity = 'Critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN severity = 'High' THEN 1 END) as high_alerts,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as alerts_24h,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as alerts_7d
      FROM security_alerts
    `);
    console.log('   ✅ alert_statistics view created\n');

    // 4. Test all queries
    console.log('4️⃣ Testing queries...');
    
    const t1 = await pool.query('SELECT COUNT(*) FROM audit_logs');
    console.log('   ✅ audit_logs: ' + t1.rows[0].count + ' rows');

    const t2 = await pool.query('SELECT * FROM recent_alerts LIMIT 1');
    console.log('   ✅ recent_alerts: works (' + t2.rows.length + ' rows)');

    const t3 = await pool.query('SELECT * FROM alert_statistics');
    console.log('   ✅ alert_statistics: total=' + t3.rows[0].total_alerts);

    const t4 = await pool.query('SELECT paypal_order_id FROM payments LIMIT 1');
    console.log('   ✅ payments: works');

    console.log('\n✅ All database fixes applied successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fix();
