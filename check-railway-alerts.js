import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function checkRailway() {
  try {
    console.log('🔍 Checking Railway Production Database...\n');
    
    const alerts = await pool.query('SELECT * FROM security_alerts ORDER BY created_at DESC LIMIT 10');
    console.log(`🚨 Total Alerts: ${alerts.rowCount}`);
    
    if (alerts.rows.length > 0) {
      console.log('\nRecent Alerts:');
      alerts.rows.forEach(a => {
        console.log(`  ${a.created_at.toLocaleString()} | ${a.app_detected} on ${a.device_id} | ${a.status}`);
      });
    } else {
      console.log('\n❌ No alerts found in Railway database!');
      console.log('\n📌 This means the Tauri Agent has NOT reported any violations yet.');
      console.log('\n✅ To fix this:');
      console.log('   1. Open the Tauri Agent window (should be running now)');
      console.log('   2. Log in with: admin / admin123');
      console.log('   3. Agent will sync forbidden apps (including chrome.exe)');
      console.log('   4. Agent will scan processes every 60 seconds');
      console.log('   5. Alerts will appear within 1-2 minutes');
    }
    
    const forbidden = await pool.query('SELECT * FROM forbidden_apps ORDER BY created_at DESC');
    console.log(`\n📋 Forbidden Apps Configured: ${forbidden.rowCount}`);
    forbidden.rows.slice(0,5).forEach(app => {
      console.log(`   - ${app.process_name} (${app.severity})`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRailway();
