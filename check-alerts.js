import { setCurrentUserId, getAllSecurityAlerts, getAllForbiddenApps } from './itam-saas/Agent/queries.js';

async function checkAlerts() {
  try {
    await setCurrentUserId(1);
    
    const apps = await getAllForbiddenApps();
    console.log(`\n📋 Forbidden Apps: ${apps.length} total`);
    apps.forEach(app => console.log(`   - ${app.process_name} (${app.severity})`));
    
    const alerts = await getAllSecurityAlerts(50);
    console.log(`\n🚨 Security Alerts: ${alerts.length} total\n`);
    
    if (alerts.length > 0) {
      console.log('Recent alerts:');
      alerts.slice(0,10).forEach(a => {
        console.log(`   ${a.created_at} | ${a.app_detected} on ${a.device_id} | Status: ${a.status}`);
      });
    } else {
      console.log('❌ No alerts found!\n');
      console.log('Troubleshooting:');
      console.log('1. Is the Tauri Agent logged in? (Check the agent window)');
      console.log('2. Is Chrome running? (It is - we verified earlier)');
      console.log('3. Agent needs to be authenticated with admin/admin123');
      console.log('4. Agent syncs forbidden apps every 5 minutes');
      console.log('5. Agent scans processes every 60 seconds');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAlerts();
