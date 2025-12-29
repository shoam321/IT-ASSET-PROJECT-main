require('dotenv').config({ path: './itam-saas/Agent/.env' });
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'IT Asset Management <onboarding@resend.dev>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function sendLowStockEmail(to, itemName, currentStock, minStock, unit, isOutOfStock, itemDetails) {
  const stockPercentage = (currentStock / minStock) * 100;
  const isCritical = isOutOfStock || currentStock === 0;
  const isUrgent = stockPercentage <= 25 && stockPercentage > 0;
  const isWarning = stockPercentage > 25 && stockPercentage <= 50;
  
  let severity, color, bgColor, icon, title, urgencyMessage, actionText;
  
  if (isCritical) {
    severity = 'CRITICAL';
    color = '#dc2626';
    bgColor = '#fee2e2';
    icon = '🚨';
    title = 'OUT OF STOCK - CRITICAL ALERT';
    urgencyMessage = 'This item is completely out of stock. Immediate action is required to prevent operational disruption.';
    actionText = 'Order Immediately';
  } else if (isUrgent) {
    severity = 'URGENT';
    color = '#ea580c';
    bgColor = '#ffedd5';
    icon = '⚠️';
    title = 'URGENT: Stock Running Very Low';
    urgencyMessage = `Only ${currentStock} ${unit} remaining (${Math.round(stockPercentage)}% of minimum). Order now to avoid stockout.`;
    actionText = 'Order Now';
  } else if (isWarning) {
    severity = 'WARNING';
    color = '#f59e0b';
    bgColor = '#fef3c7';
    icon = '📦';
    title = 'Low Stock Warning';
    urgencyMessage = `Stock is running low at ${currentStock} ${unit} (${Math.round(stockPercentage)}% of minimum). Please plan to reorder soon.`;
    actionText = 'Review & Order';
  } else {
    severity = 'NOTICE';
    color = '#3b82f6';
    bgColor = '#dbeafe';
    icon = '📋';
    title = 'Stock Level Notice';
    urgencyMessage = `${itemName} is approaching minimum stock level.`;
    actionText = 'View Details';
  }

  const additionalInfo = itemDetails.category || itemDetails.supplier || itemDetails.lastOrderDate 
    ? `
      <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #374151;">Additional Information:</p>
        ${itemDetails.category ? `<p style="margin: 5px 0; color: #6b7280;"><strong>Category:</strong> ${itemDetails.category}</p>` : ''}
        ${itemDetails.supplier ? `<p style="margin: 5px 0; color: #6b7280;"><strong>Supplier:</strong> ${itemDetails.supplier}</p>` : ''}
        ${itemDetails.lastOrderDate ? `<p style="margin: 5px 0; color: #6b7280;"><strong>Last Ordered:</strong> ${new Date(itemDetails.lastOrderDate).toLocaleDateString()}</p>` : ''}
        ${itemDetails.reorderQuantity ? `<p style="margin: 5px 0; color: #6b7280;"><strong>Suggested Reorder:</strong> ${itemDetails.reorderQuantity} ${unit}</p>` : ''}
      </div>
    ` : '';

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: to,
    subject: `${icon} ${severity}: ${itemName} Stock Alert`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${icon} ${title}</h1>
          <p style="color: rgba(255,255,255,0.95); margin: 10px 0 0 0; font-size: 16px;">${severity} Priority</p>
        </div>

        <div style="background: white; padding: 30px; border: 2px solid ${color}; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; line-height: 1.6; color: #374151; margin: 0 0 20px 0;">
            ${urgencyMessage}
          </p>

          <div style="background: ${bgColor}; border-left: 6px solid ${color}; padding: 25px; border-radius: 8px; margin: 25px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #374151;"><strong style="font-size: 15px;">Item Name:</strong></td>
                <td style="padding: 8px 0; text-align: right; color: #111827; font-weight: 600;">${itemName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #374151;"><strong style="font-size: 15px;">Current Stock:</strong></td>
                <td style="padding: 8px 0; text-align: right;"><span style="color: ${color}; font-weight: bold; font-size: 18px;">${currentStock} ${unit}</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #374151;"><strong style="font-size: 15px;">Minimum Required:</strong></td>
                <td style="padding: 8px 0; text-align: right; color: #111827; font-weight: 600;">${minStock} ${unit}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #374151;"><strong style="font-size: 15px;">Stock Level:</strong></td>
                <td style="padding: 8px 0; text-align: right;"><span style="color: ${color}; font-weight: bold;">${Math.round(stockPercentage)}% of minimum</span></td>
              </tr>
            </table>
            ${isCritical ? `
              <div style="margin-top: 20px; padding: 15px; background: rgba(220, 38, 38, 0.1); border-radius: 6px; border: 2px dashed ${color};">
                <p style="margin: 0; color: ${color}; font-weight: bold; font-size: 14px; text-align: center;">⚠️ IMMEDIATE REORDER REQUIRED ⚠️</p>
              </div>
            ` : ''}
          </div>

          ${additionalInfo}

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 12px 0; font-weight: bold; color: #111827;">📋 Recommended Actions:</p>
            <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.8;">
              ${isCritical ? `
                <li><strong>Contact supplier immediately</strong></li>
                <li>Check alternative suppliers for faster delivery</li>
                <li>Notify teams that may be affected by the shortage</li>
              ` : isUrgent ? `
                <li>Place order within 24 hours</li>
                <li>Verify supplier availability and lead times</li>
                <li>Monitor usage until restocked</li>
              ` : `
                <li>Review current usage patterns</li>
                <li>Plan reorder for next procurement cycle</li>
                <li>Update minimum stock levels if needed</li>
              `}
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0 20px 0;">
            <a href="${FRONTEND_URL}/consumables" style="display: inline-block; padding: 16px 40px; background-color: ${color}; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              ${actionText}
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 20px 0 0 0;">
            Click above to access the inventory management system
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f3f4f6; border-radius: 8px;">
          <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
            <strong>IT Asset Management System</strong><br>
            Automated Inventory Alert • Sent: ${new Date().toLocaleString()}<br>
            ${isCritical ? '🔴 Critical Priority' : isUrgent ? '🟠 Urgent Priority' : '🟡 Medium Priority'}
          </p>
        </div>
      </div>
    `
  });

  if (error) {
    console.error('❌ Email send error:', error);
    throw error;
  }

  return data;
}

async function testLowStockEmails() {
  const testEmail = 'tjh852321@gmail.com';
  
  console.log('📧 Testing Low Stock Alert Emails...\n');
  console.log('Using API Key:', process.env.RESEND_API_KEY ? '✅ Found' : '❌ Not Found');
  console.log('');

  try {
    // Test 1: Critical
    console.log('1️⃣ Testing CRITICAL - Out of Stock Alert...');
    await sendLowStockEmail(testEmail, 'Laptop Chargers (USB-C)', 0, 20, 'units', true, {
      category: 'Computer Accessories',
      supplier: 'TechSupply Inc.',
      lastOrderDate: '2024-11-15',
      reorderQuantity: 50
    });
    console.log('✅ Critical alert sent\n');
    await sleep(2000);

    // Test 2: Urgent
    console.log('2️⃣ Testing URGENT - Very Low Stock (20%)...');
    await sendLowStockEmail(testEmail, 'Wireless Mice', 4, 20, 'units', false, {
      category: 'Computer Peripherals',
      supplier: 'Office Depot',
      lastOrderDate: '2024-12-01',
      reorderQuantity: 30
    });
    console.log('✅ Urgent alert sent\n');
    await sleep(2000);

    // Test 3: Warning
    console.log('3️⃣ Testing WARNING - Low Stock (40%)...');
    await sendLowStockEmail(testEmail, 'HDMI Cables (2m)', 8, 20, 'units', false, {
      category: 'Cables & Adapters',
      supplier: 'Cable World',
      reorderQuantity: 25
    });
    console.log('✅ Warning alert sent\n');
    await sleep(2000);

    // Test 4: Notice
    console.log('4️⃣ Testing NOTICE - Approaching Low Stock (60%)...');
    await sendLowStockEmail(testEmail, 'Printer Toner Cartridges (Black)', 12, 20, 'units', false, {
      category: 'Printer Supplies',
      supplier: 'PrintMaster Solutions'
    });
    console.log('✅ Notice alert sent\n');

    console.log('✨ All test emails sent! Check your inbox at:', testEmail);
    console.log('\nYou should receive 4 different emails:');
    console.log('  🚨 CRITICAL - Out of Stock (Red)');
    console.log('  ⚠️  URGENT - Very Low Stock (Orange)');
    console.log('  📦 WARNING - Low Stock (Yellow)');
    console.log('  📋 NOTICE - Approaching Low (Blue)');
  } catch (error) {
    console.error('❌ Error sending emails:', error);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testLowStockEmails().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
