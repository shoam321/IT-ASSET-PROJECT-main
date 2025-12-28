// Quick test - send usage data from agent
const response = await fetch('https://your-railway-url.railway.app/api/agent/usage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-agent-api-key'
  },
  body: JSON.stringify({
    device_id: 'LT-SHOAM-TA',
    app_name: 'Test App',
    window_title: 'Test Window',
    duration: 100,
    timestamp: new Date().toISOString()
  })
});

console.log('Status:', response.status);
console.log('Result:', await response.json());
