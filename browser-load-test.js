/**
 * Browser-based Load Test with Playwright
 * Simulates real user interactions with the web interface
 */

import { chromium } from 'playwright';

const BASE_URL = 'https://it-asset-project-production.up.railway.app';
const CONCURRENT_BROWSERS = 5;
const ITERATIONS_PER_BROWSER = 3;

async function simulateBrowserUser(userId) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log(`🌐 Browser ${userId} starting...`);
  
  try {
    for (let i = 0; i < ITERATIONS_PER_BROWSER; i++) {
      console.log(`  Browser ${userId} - Iteration ${i + 1}/${ITERATIONS_PER_BROWSER}`);
      
      // 1. Navigate to login
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // 2. Login
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'your-password');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
      
      // 3. Navigate to devices page
      await page.click('text=Devices');
      await page.waitForLoadState('networkidle');
      
      // 4. Navigate to assets page
      await page.click('text=Assets');
      await page.waitForLoadState('networkidle');
      
      // 5. Navigate to licenses page
      await page.click('text=Licenses');
      await page.waitForLoadState('networkidle');
      
      // 6. Check alerts
      await page.click('text=Alerts');
      await page.waitForLoadState('networkidle');
      
      console.log(`  ✅ Browser ${userId} completed iteration ${i + 1}`);
      
      // Wait a bit before next iteration
      await page.waitForTimeout(2000);
    }
    
    console.log(`✅ Browser ${userId} finished all iterations`);
  } catch (error) {
    console.error(`❌ Browser ${userId} error:`, error.message);
  } finally {
    await browser.close();
  }
}

async function runBrowserLoadTest() {
  console.log('🚀 Starting Browser Load Test...\n');
  console.log(`Configuration:`);
  console.log(`  Concurrent Browsers: ${CONCURRENT_BROWSERS}`);
  console.log(`  Iterations per Browser: ${ITERATIONS_PER_BROWSER}\n`);
  
  const startTime = Date.now();
  
  // Launch concurrent browsers
  const browsers = [];
  for (let i = 0; i < CONCURRENT_BROWSERS; i++) {
    browsers.push(simulateBrowserUser(i + 1));
  }
  
  // Wait for all browsers to complete
  await Promise.all(browsers);
  
  const duration = Date.now() - startTime;
  
  console.log('\n📊 Browser Load Test Complete!');
  console.log(`Total Time: ${(duration / 1000).toFixed(2)}s`);
  console.log(`Total User Sessions: ${CONCURRENT_BROWSERS * ITERATIONS_PER_BROWSER}`);
}

runBrowserLoadTest().catch(console.error);
