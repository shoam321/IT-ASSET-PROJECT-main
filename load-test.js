import http from 'k6/http';
import { sleep, check } from 'k6';

// Load test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Maintain 100 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
  },
};

const BASE_URL = 'https://it-asset-project-production.up.railway.app';

// Test login and get token
export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, 
    JSON.stringify({
      email: 'test@example.com',
      password: 'your-test-password'
    }), 
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  return { token: loginRes.json('token') };
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Test 1: Get devices
  let res = http.get(`${BASE_URL}/api/agent/devices`, { headers });
  check(res, {
    'devices status is 200': (r) => r.status === 200,
    'devices response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test 2: Get assets
  res = http.get(`${BASE_URL}/api/assets`, { headers });
  check(res, {
    'assets status is 200': (r) => r.status === 200,
  });

  sleep(1);

  // Test 3: Get licenses
  res = http.get(`${BASE_URL}/api/licenses`, { headers });
  check(res, {
    'licenses status is 200': (r) => r.status === 200,
  });

  sleep(2);

  // Test 4: Submit usage data (agent simulation)
  res = http.post(`${BASE_URL}/api/agent/usage`,
    JSON.stringify({
      device_id: `TEST-DEVICE-${__VU}-${__ITER}`,
      app_name: 'LoadTestApp',
      window_title: 'k6 Load Test',
      duration: Math.floor(Math.random() * 1000),
      timestamp: Date.now()
    }),
    { headers }
  );
  check(res, {
    'usage post status is 201': (r) => r.status === 201,
  });

  sleep(1);
}
