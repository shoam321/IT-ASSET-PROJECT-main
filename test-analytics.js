// Test the analytics dashboard endpoint
// Run this with: node test-analytics.js

import fetch from 'node-fetch';

// You need to replace this token with the one from your browser's localStorage
// Open browser console and run: localStorage.getItem('token')
const TOKEN = process.argv[2];

if (!TOKEN) {
  console.log('❌ Please provide a token as argument:');
  console.log('   node test-analytics.js YOUR_TOKEN_HERE');
  console.log('\n   Get your token from browser console: localStorage.getItem("token")');
  process.exit(1);
}

async function testAnalytics() {
  try {
    console.log('🧪 Testing analytics endpoint...\n');
    console.log('Token:', TOKEN.substring(0, 20) + '...\n');

    const response = await fetch('http://localhost:5000/api/analytics/dashboard', {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
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
