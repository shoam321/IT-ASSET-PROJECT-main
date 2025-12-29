// Test the analytics dashboard endpoint
// Run this with: node test-analytics.js

import fetch from 'node-fetch';

async function loginAndGetToken(baseUrl, username, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.token;
}

// You need to replace this token with the one from your browser's localStorage
// Open browser console and run: localStorage.getItem('token')
const args = process.argv.slice(2);
const TOKEN = args[0] && !args[0].startsWith('--') ? args[0] : null;
const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
const uIdx = args.findIndex(a => a === '--username');
const pIdx = args.findIndex(a => a === '--password');
const username = uIdx !== -1 ? args[uIdx + 1] : null;
const password = pIdx !== -1 ? args[pIdx + 1] : null;

if (!TOKEN && (!username || !password)) {
  console.log('❌ Provide a token or username/password:');
  console.log('   node test-analytics.js YOUR_TOKEN_HERE');
  console.log('   node test-analytics.js --username <u> --password <p>');
  console.log('\n   Tip: You can still use browser token: localStorage.getItem("token")');
  process.exit(1);
}

async function testAnalytics() {
  try {
    let token = TOKEN;
    if (!token) {
      console.log('🔐 Logging in to obtain token...');
      token = await loginAndGetToken(baseUrl, username, password);
    }
    console.log('🧪 Testing analytics endpoint...\n');
    console.log('Token:', token.substring(0, 20) + '...\n');

    const response = await fetch(`${baseUrl}/api/analytics/dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Error Response:', errorText);
      process.exit(1);
    }

    const data = await response.json();
    console.log('✅ Success! Analytics data:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testAnalytics();
