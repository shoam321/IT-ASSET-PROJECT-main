const https = require('https');

const baseUrl = 'https://it-asset-project-production.up.railway.app';

const endpoints = [
  '/health',
  '/api/billing',
  '/api/alerts?limit=10',
  '/api/alerts/stats',
];

async function testEndpoint(path) {
  return new Promise((resolve) => {
    const url = baseUrl + path;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`${res.statusCode} ${path}`);
        if (res.statusCode >= 400) {
          console.log(`   Response: ${data.substring(0, 200)}`);
        }
        resolve();
      });
    }).on('error', (e) => {
      console.log(`ERR ${path}: ${e.message}`);
      resolve();
    });
  });
}

async function main() {
  console.log('Testing Railway endpoints...\n');
  for (const ep of endpoints) {
    await testEndpoint(ep);
  }
  console.log('\nDone');
}

main();
