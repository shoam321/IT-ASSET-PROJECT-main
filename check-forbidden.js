import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: './itam-saas/Agent/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
});

async function checkForbiddenAppsAndAlerts() {
  try {
    console.log('🔍 Checking Forbidden Apps...\n');
    const forbiddenApps = await pool.query('SELECT * FROM forbidden_apps ORDER BY created_at DESC');
    
    if (forbiddenApps.rows.length === 0) {
      console.log('❌ No forbidden apps found in database!');
    } else {
      console.log('✅ Forbidden Apps:');
      console.table(forbiddenApps.rows);
    }
    
    console.log('\n🔍 Checking Security Alerts...\n');
    const alerts = await pool.query('SELECT * FROM security_alerts ORDER BY created_at DESC LIMIT 20');
    
    if (alerts.rows.length === 0) {
      console.log('❌ No security alerts found!');
    } else {
      console.log('✅ Security Alerts:');
      console.table(alerts.rows);
    }
    
    console.log('\n🔍 Checking Recent Alerts View...\n');
    const recentAlerts = await pool.query('SELECT * FROM recent_alerts LIMIT 10');
    
    if (recentAlerts.rows.length === 0) {
      console.log('❌ No recent alerts in view!');
    } else {
      console.log('✅ Recent Alerts View:');
      console.table(recentAlerts.rows);
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkForbiddenAppsAndAlerts();
