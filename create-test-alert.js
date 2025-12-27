import { createSecurityAlert, setCurrentUserId } from './itam-saas/Agent/queries.js';

async function createTestAlert() {
  try {
    // Set admin user context
    await setCurrentUserId(1);
    
    // Create a test alert for Chrome
    const alertData = {
      device_id: 'TEST-DEVICE',
      app_detected: 'chrome.exe',
      severity: 'Medium',
      process_id: 12345,
      user_id: 1
    };
    
    console.log('Creating test security alert...');
    const alert = await createSecurityAlert(alertData);
    console.log('✅ Alert created successfully:', alert);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestAlert();
