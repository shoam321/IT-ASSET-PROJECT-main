import dotenv from 'dotenv';
import { sendLowStockAlertEmail } from './itam-saas/Agent/emailService.js';

// Load environment variables
dotenv.config({ path: './itam-saas/Agent/.env' });

async function testLowStockEmails() {
  const testEmail = 'tjh852321@gmail.com'; // Your registered Resend email
  
  console.log('📧 Testing Low Stock Alert Emails...\n');

  // Test 1: Critical - Out of Stock
  console.log('1️⃣ Testing CRITICAL - Out of Stock Alert...');
  await sendLowStockAlertEmail(
    testEmail,
    'Laptop Chargers (USB-C)',
    0,
    20,
    'units',
    true,
    {
      category: 'Computer Accessories',
      supplier: 'TechSupply Inc.',
      lastOrderDate: '2024-11-15',
      reorderQuantity: 50
    }
  );
  console.log('✅ Critical alert sent\n');

  await sleep(2000); // Wait 2 seconds between emails

  // Test 2: Urgent - Very Low Stock (20% of minimum)
  console.log('2️⃣ Testing URGENT - Very Low Stock (20%)...');
  await sendLowStockAlertEmail(
    testEmail,
    'Wireless Mice',
    4,
    20,
    'units',
    false,
    {
      category: 'Computer Peripherals',
      supplier: 'Office Depot',
      lastOrderDate: '2024-12-01',
      reorderQuantity: 30
    }
  );
  console.log('✅ Urgent alert sent\n');

  await sleep(2000);

  // Test 3: Warning - Low Stock (40% of minimum)
  console.log('3️⃣ Testing WARNING - Low Stock (40%)...');
  await sendLowStockAlertEmail(
    testEmail,
    'HDMI Cables (2m)',
    8,
    20,
    'units',
    false,
    {
      category: 'Cables & Adapters',
      supplier: 'Cable World',
      reorderQuantity: 25
    }
  );
  console.log('✅ Warning alert sent\n');

  await sleep(2000);

  // Test 4: Notice - Approaching Low Stock (60% of minimum)
  console.log('4️⃣ Testing NOTICE - Approaching Low Stock (60%)...');
  await sendLowStockAlertEmail(
    testEmail,
    'Printer Toner Cartridges (Black)',
    12,
    20,
    'units',
    false,
    {
      category: 'Printer Supplies',
      supplier: 'PrintMaster Solutions'
    }
  );
  console.log('✅ Notice alert sent\n');

  console.log('✨ All test emails sent! Check your inbox at:', testEmail);
  console.log('\nYou should receive 4 different emails:');
  console.log('  🚨 CRITICAL - Out of Stock (Red)');
  console.log('  ⚠️  URGENT - Very Low Stock (Orange)');
  console.log('  📦 WARNING - Low Stock (Yellow)');
  console.log('  📋 NOTICE - Approaching Low (Blue)');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testLowStockEmails().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
