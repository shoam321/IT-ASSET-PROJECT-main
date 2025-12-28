/**
 * Simple Load Test Script
 * Simulates multiple concurrent users hitting your API
 */

const BASE_URL = 'https://it-asset-project-production.up.railway.app';

// Configuration
const TOTAL_REQUESTS = 100;
const CONCURRENT_USERS = 10;
const REQUEST_DELAY_MS = 100; // Delay between requests per user

let successCount = 0;
let errorCount = 0;
let totalTime = 0;

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'your-password'
    })
  });
  const data = await response.json();
  return data.token;
}

async function makeRequest(endpoint, token, method = 'GET', body = null) {
  const startTime = Date.now();
  
  try {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      successCount++;
      totalTime += duration;
      return { success: true, duration, status: response.status };
    } else {
      errorCount++;
      return { success: false, duration, status: response.status };
    }
  } catch (error) {
    errorCount++;
    return { success: false, error: error.message, duration: Date.now() - startTime };
  }
}

async function simulateUser(userId, token, requestsPerUser) {
  console.log(`👤 User ${userId} starting ${requestsPerUser} requests...`);
  
  const endpoints = [
    { path: '/api/agent/devices', method: 'GET' },
    { path: '/api/assets', method: 'GET' },
    { path: '/api/licenses', method: 'GET' },
    { path: '/api/agent/usage', method: 'POST', body: {
      device_id: `LOAD-TEST-${userId}`,
      app_name: 'LoadTest',
      window_title: 'Simulated Usage',
      duration: Math.floor(Math.random() * 1000),
      timestamp: Date.now()
    }}
  ];
  
  for (let i = 0; i < requestsPerUser; i++) {
    const endpoint = endpoints[i % endpoints.length];
    const result = await makeRequest(endpoint.path, token, endpoint.method, endpoint.body);
    
    if (result.success) {
      console.log(`  ✅ User ${userId} request ${i + 1}: ${result.status} (${result.duration}ms)`);
    } else {
      console.log(`  ❌ User ${userId} request ${i + 1}: ${result.status || 'ERROR'} (${result.duration}ms)`);
    }
    
    // Small delay between requests
    if (i < requestsPerUser - 1) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }
  
  console.log(`✅ User ${userId} completed`);
}

async function runLoadTest() {
  console.log('🚀 Starting Load Test...\n');
  console.log(`Configuration:`);
  console.log(`  Total Requests: ${TOTAL_REQUESTS}`);
  console.log(`  Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`  Requests per User: ${Math.ceil(TOTAL_REQUESTS / CONCURRENT_USERS)}\n`);
  
  // Login once to get token
  console.log('🔐 Logging in...');
  const token = await login();
  console.log('✅ Login successful\n');
  
  const requestsPerUser = Math.ceil(TOTAL_REQUESTS / CONCURRENT_USERS);
  const startTime = Date.now();
  
  // Create concurrent users
  const users = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    users.push(simulateUser(i + 1, token, requestsPerUser));
  }
  
  // Wait for all users to complete
  await Promise.all(users);
  
  const totalDuration = Date.now() - startTime;
  
  // Print results
  console.log('\n📊 Load Test Results:');
  console.log('='.repeat(50));
  console.log(`Total Time: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Total Requests: ${successCount + errorCount}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`Success Rate: ${((successCount / (successCount + errorCount)) * 100).toFixed(2)}%`);
  console.log(`Average Response Time: ${(totalTime / successCount).toFixed(2)}ms`);
  console.log(`Requests/Second: ${((successCount + errorCount) / (totalDuration / 1000)).toFixed(2)}`);
  console.log('='.repeat(50));
}

// Run the test
runLoadTest().catch(console.error);
