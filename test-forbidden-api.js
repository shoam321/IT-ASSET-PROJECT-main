// Test script to verify forbidden apps API
const API_URL = 'https://it-asset-project-production.up.railway.app';

async function testForbiddenAppsAPI() {
  console.log('🔄 Testing Forbidden Apps API...');
  console.log(`API URL: ${API_URL}`);
  console.log('');
  
  // Test 1: Login to get token
  console.log('Test 1: Login to get authentication token');
  try {
    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      console.error(`❌ Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
      const error = await loginResponse.text();
      console.error('Error:', error);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful');
    console.log(`Token received: ${loginData.token.substring(0, 20)}...`);
    console.log('');
    
    const token = loginData.token;
    
    // Test 2: Fetch forbidden apps
    console.log('Test 2: Fetch forbidden apps list');
    const forbiddenAppsResponse = await fetch(`${API_URL}/api/forbidden-apps`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!forbiddenAppsResponse.ok) {
      console.error(`❌ Forbidden apps fetch failed: ${forbiddenAppsResponse.status} ${forbiddenAppsResponse.statusText}`);
      const error = await forbiddenAppsResponse.text();
      console.error('Error:', error);
      return;
    }
    
    const forbiddenApps = await forbiddenAppsResponse.json();
    console.log(`✅ Forbidden apps fetched successfully`);
    console.log(`Total apps: ${forbiddenApps.length}`);
    console.log('');
    console.log('Forbidden Apps:');
    forbiddenApps.forEach((app, index) => {
      console.log(`  ${index + 1}. ${app.process_name} - ${app.severity} - ${app.description}`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testForbiddenAppsAPI();
