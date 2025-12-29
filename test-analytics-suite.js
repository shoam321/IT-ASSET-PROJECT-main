// Comprehensive analytics dashboard access tests
// Usage:
//  node test-analytics-suite.js --base http://localhost:5000 --admin <username> --adminPass <password>
//  node test-analytics-suite.js --base https://it-asset-project-production.up.railway.app

// Uses global fetch (Node 18+). If running older Node,
// set up fetch via node-fetch or cross-fetch.

function arg(key, def = null) {
  const idx = process.argv.indexOf(key);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : def;
}

const BASE = arg('--base', process.env.API_BASE_URL || 'http://localhost:5000');

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.token;
}

async function register(username, email, password) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  if (!res.ok) throw new Error(`Register failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.token;
}

async function getAnalytics(token) {
  const res = await fetch(`${BASE}/api/analytics/dashboard`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return res;
}

async function main() {
  console.log('🧪 Running analytics access tests against', BASE);
  let failures = 0;

  // 1) Unauthenticated → 401
  const unauth = await getAnalytics(null);
  console.log('Unauthenticated status:', unauth.status);
  if (unauth.status !== 401) { console.log('❌ Expected 401'); failures++; }

  // 2) Authorized → 200 (if admin creds provided)
  const adminUser = arg('--admin');
  const adminPass = arg('--adminPass');
  if (adminUser && adminPass) {
    try {
      const adminToken = await login(adminUser, adminPass);
      const authRes = await getAnalytics(adminToken);
      console.log('Authorized status:', authRes.status);
      if (authRes.status !== 200) { console.log('❌ Expected 200'); failures++; }
    } catch (e) {
      console.log('⚠️ Admin login failed:', e.message);
      failures++;
    }
  } else {
    console.log('ℹ️ Skipping authorized test (no admin creds provided).');
  }

  // 3) Unauthorized user → 403 (register default user)
  const uname = `test_user_${Date.now()}`;
  try {
    const userToken = await register(uname, `${uname}@example.com`, 'Test1234!');
    const forbRes = await getAnalytics(userToken);
    console.log('Unauthorized user status:', forbRes.status);
    if (forbRes.status !== 403) { console.log('❌ Expected 403'); failures++; }
  } catch (e) {
    console.log('ℹ️ Skipping unauthorized test (register failed):', e.message);
  }

  if (failures === 0) {
    console.log('✅ All analytics access tests passed');
  } else {
    console.log(`❌ ${failures} test(s) failed`);
  }
}

main();
