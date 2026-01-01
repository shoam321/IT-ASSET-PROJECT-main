import 'dotenv/config';

const API_URL = 'https://it-asset-project-production.up.railway.app';

async function test() {
  // Login
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Shoam1', password: '852321' })
  });
  const { token } = await loginRes.json();
  console.log('✅ Logged in\n');
  
  // Get assets
  console.log('📦 Fetching assets...');
  const assetsRes = await fetch(`${API_URL}/api/assets`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const assets = await assetsRes.json();
  console.log(`✅ Got ${assets.length} assets!`);
  
  if (assets.length > 0) {
    console.log('\nFirst 3 assets:');
    assets.slice(0, 3).forEach(a => {
      console.log(`  - ${a.asset_tag}: ${a.manufacturer} ${a.model} (${a.status})`);
    });
  }
}

test().catch(console.error);
