// Check user role and RLS status via API
const API_URL = "https://it-asset-project-production.up.railway.app/api";

async function checkSystem() {
  try {
    console.log('🔍 Checking system configuration...\n');
    
    // You'll need to provide credentials
    const username = 'shoam052603866@gmail.com'; // or actual username
    const password = 'YOUR_PASSWORD'; // Replace with actual password
    
    console.log('Attempting login...');
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      console.log('\n⚠️  Please update the credentials in check-system.js');
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful');
    console.log('\n👤 Token Payload:');
    
    // Decode JWT to see role
    const tokenParts = loginData.token.split('.');
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    console.log('   User ID:', payload.userId || payload.id);
    console.log('   Username:', payload.username);
    console.log('   Role:', payload.role);
    console.log('   Email:', payload.email);
    
    if (payload.role === 'admin') {
      console.log('\n🔑 THIS USER IS AN ADMIN - That\'s why they see all devices!');
    } else {
      console.log('\n👤 This user is a regular user');
      console.log('   They should only see their own devices');
      console.log('   If seeing all devices, RLS migration may not have been run');
    }
    
    // Get devices
    console.log('\n💻 Fetching devices...');
    const devicesResponse = await fetch(`${API_URL}/agent/devices`, {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    
    if (devicesResponse.ok) {
      const devices = await devicesResponse.json();
      console.log(`   Found ${devices.length} device(s):`);
      devices.forEach(d => {
        console.log(`   - ${d.device_id} (user_id: ${d.user_id || 'NULL'})`);
      });
      
      // Check if all devices have this user's ID
      const userDevices = devices.filter(d => d.user_id === payload.userId || d.user_id === payload.id);
      if (userDevices.length === devices.length && devices.length > 0) {
        console.log('\n✅ All devices belong to this user (correct behavior)');
      } else if (payload.role === 'admin') {
        console.log('\n✅ Admin seeing all devices (correct behavior)');
      } else {
        console.log('\n❌ User seeing devices that don\'t belong to them!');
        console.log('   This means RLS is NOT working');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSystem();
