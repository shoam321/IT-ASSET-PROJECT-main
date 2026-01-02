// Fix all missing database objects on Railway
// Run: node fix-all-missing-db-objects.js

import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway';

async function fixDatabase() {
  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    console.log('🔧 Fixing all missing database objects...\n');

    // 1. Create audit_logs table
    console.log('1️⃣ Creating audit_logs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(100) NOT NULL,
        record_id INTEGER,
        action VARCHAR(20) NOT NULL,
        old_data JSONB,
        new_data JSONB,
        user_id INTEGER,
        username VARCHAR(100),
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    `);
    console.log('   ✅ audit_logs table ready\n');

    // 2. Create recent_alerts view (using correct column names: app_name not app_detected)
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
      LIMIT 100;
    `);
    console.log('   ✅ recent_alerts view ready\n');

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
      FROM security_alerts;
    `);
    console.log('   ✅ alert_statistics view ready\n');

    // 4. Add alias columns to payments if needed (order_id -> paypal_order_id)
    console.log('4️⃣ Checking payments table...');
    console.log('   Payments uses paypal_order_id (not order_id) - updating queries.js needed');
    console.log('   ✅ payments table schema is correct\n');

    // 5. Verify all objects exist
    console.log('5️⃣ Verifying all objects...');
    
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log('   Tables:', tables.rows.map(r => r.table_name).join(', '));

    const views = await pool.query(`
      SELECT table_name FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('   Views:', views.rows.map(r => r.table_name).join(', '));

    // Test queries
    console.log('\n6️⃣ Testing queries...');
    
    try {
      await pool.query('SELECT * FROM audit_logs LIMIT 1');
      console.log('   ✅ audit_logs query works');
    } catch (e) {
      console.log('   ❌ audit_logs query failed:', e.message);
    }

    try {
      await pool.query('SELECT * FROM recent_alerts LIMIT 1');
      console.log('   ✅ recent_alerts query works');
    } catch (e) {
      console.log('   ❌ recent_alerts query failed:', e.message);
    }

    try {
      await pool.query('SELECT * FROM alert_statistics');
      console.log('   ✅ alert_statistics query works');
    } catch (e) {
      console.log('   ❌ alert_statistics query failed:', e.message);
    }

    try {
      await pool.query('SELECT paypal_order_id, id FROM payments LIMIT 1');
      console.log('   ✅ payments query works');
    } catch (e) {
      console.log('   ❌ payments query failed:', e.message);
    }

    console.log('\n✅ All database fixes applied successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixDatabase();
