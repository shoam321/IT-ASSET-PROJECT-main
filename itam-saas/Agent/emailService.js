import { Resend } from 'resend';

// Only initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@itasset.local';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(to, resetToken, userName) {
  try {
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping password reset email');
      return null;
    }

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: 'Reset Your Password - IT Asset Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Password Reset Request</h2>
          <p>Hi ${userName || 'there'},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
          <p style="color: #666;">This link will expire in 1 hour.</p>
          <p style="color: #666;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #999; font-size: 12px;">IT Asset Tracker Security Team</p>
        </div>
      `
    });

    if (error) {
      console.error('❌ Email send error:', error);
      throw error;
    }

    console.log('✅ Password reset email sent to:', to);
    return data;
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error);
    // Don't throw - we don't want email failures to break the API
    return null;
  }
}

/**
 * Send asset assignment notification
 */
export async function sendAssetAssignmentEmail(to, userName, assetTag, assetType, category) {
  try {
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping asset assignment email');
      return null;
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: `New Asset Assigned: ${assetTag}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">🎉 New Asset Assigned</h2>
          <p>Hi ${userName || 'there'},</p>
          <p>A new asset has been assigned to you:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Asset Tag:</strong> ${assetTag}</p>
            ${assetType ? `<p style="margin: 5px 0;"><strong>Type:</strong> ${assetType}</p>` : ''}
            ${category ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>` : ''}
          </div>
          <p>Please take care of this equipment and report any issues to IT support.</p>
          <a href="${FRONTEND_URL}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View My Assets</a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #999; font-size: 12px;">IT Asset Management System</p>
        </div>
      `
    });

    if (error) {
      console.error('❌ Email send error:', error);
      throw error;
    }

    console.log('✅ Asset assignment email sent to:', to);
    return data;
  } catch (error) {
    console.error('❌ Failed to send asset assignment email:', error);
    return null;
  }
}

/**
 * Send security alert email
 */
export async function sendSecurityAlertEmail(to, alertType, details, severity = 'high') {
  try {
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping security alert email');
      return null;
    }

    const severityColors = {
      critical: '#dc2626',
      high: '#ef4444',
      medium: '#f59e0b',
      low: '#3b82f6'
    };

    const color = severityColors[severity.toLowerCase()] || '#ef4444';

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: `🚨 Security Alert: ${alertType}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${color};">⚠️ Security Alert</h2>
          <p>A security issue has been detected:</p>
          <div style="background: #fee2e2; border-left: 4px solid ${color}; padding: 20px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Alert Type:</strong> ${alertType}</p>
            <p style="margin: 5px 0;"><strong>Severity:</strong> ${severity.toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Details:</strong> ${details}</p>
          </div>
          <p>Please review and take appropriate action.</p>
          <a href="${FRONTEND_URL}/security-alerts" style="display: inline-block; padding: 12px 24px; background-color: ${color}; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Alerts</a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #999; font-size: 12px;">IT Security Team</p>
        </div>
      `
    });

    if (error) {
      console.error('❌ Email send error:', error);
      throw error;
    }

    console.log(`✅ Security alert email sent to: ${to} (${severity})`);
    return data;
  } catch (error) {
    console.error('❌ Failed to send security alert email:', error);
    return null;
  }
}

/**
 * Send license expiration reminder
 */
export async function sendLicenseExpirationEmail(to, licenseName, expirationDate, daysRemaining) {
  try {
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping license expiration email');
      return null;
    }

    const formattedDate = new Date(expirationDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: `License Expiring Soon: ${licenseName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">⏰ License Expiration Notice</h2>
          <p>This is a reminder that a software license is expiring soon:</p>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>License:</strong> ${licenseName}</p>
            <p style="margin: 5px 0;"><strong>Expires:</strong> ${formattedDate}</p>
            <p style="margin: 5px 0;"><strong>Days Remaining:</strong> ${daysRemaining}</p>
          </div>
          <p>Please renew this license before it expires to avoid service interruption.</p>
          <a href="${FRONTEND_URL}/licenses" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Licenses</a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #999; font-size: 12px;">IT Asset Management System</p>
        </div>
      `
    });

    if (error) {
      console.error('❌ Email send error:', error);
      throw error;
    }

    console.log(`✅ License expiration email sent to: ${to} (${daysRemaining} days)`);
    return data;
  } catch (error) {
    console.error('❌ Failed to send license expiration email:', error);
    return null;
  }
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(to, userName, tempPassword = null) {
  try {
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping welcome email');
      return null;
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: 'Welcome to IT Asset Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Welcome to IT Asset Tracker!</h2>
          <p>Hi ${userName},</p>
          <p>Your account has been created successfully. You can now access the IT Asset Management system.</p>
          ${tempPassword ? `
          <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
            <p style="margin: 10px 0; color: #1e40af; font-size: 14px;">⚠️ Please change your password after first login</p>
          </div>
          ` : ''}
          <p>You can now:</p>
          <ul>
            <li>View and manage IT assets</li>
            <li>Track licenses and contracts</li>
            <li>Monitor device usage</li>
            <li>Generate reports</li>
          </ul>
          <a href="${FRONTEND_URL}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">Login Now</a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #999; font-size: 12px;">IT Asset Management System</p>
        </div>
      `
    });

    if (error) {
      console.error('❌ Email send error:', error);
      throw error;
    }

    console.log('✅ Welcome email sent to:', to);
    return data;
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    return null;
  }
}

/**
 * Send device usage alert email
 */
export async function sendDeviceUsageAlertEmail(to, deviceName, usageDetails) {
  try {
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping device usage alert email');
      return null;
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: `Device Activity Alert: ${deviceName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8b5cf6;">📊 Device Activity Alert</h2>
          <p>Unusual or notable activity detected on your device:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Device:</strong> ${deviceName}</p>
            <p style="margin: 5px 0;"><strong>Details:</strong> ${usageDetails}</p>
          </div>
          <p>If this activity is unexpected, please contact IT support.</p>
          <a href="${FRONTEND_URL}/devices" style="display: inline-block; padding: 12px 24px; background-color: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Device Details</a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #999; font-size: 12px;">IT Asset Management System</p>
        </div>
      `
    });

    if (error) {
      console.error('❌ Email send error:', error);
      throw error;
    }

    console.log('✅ Device usage alert email sent to:', to);
    return data;
  } catch (error) {
    console.error('❌ Failed to send device usage alert email:', error);
    return null;
  }
}

/**
 * Send low stock alert email with different templates based on severity
 */
export async function sendLowStockAlertEmail(to, itemName, currentStock, minStock, unit, isOutOfStock = false, itemDetails = {}) {
  try {
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping low stock alert email');
      return null;
    }

    // Calculate urgency level
    const stockPercentage = (currentStock / minStock) * 100;
    const isCritical = isOutOfStock || currentStock === 0;
    const isUrgent = stockPercentage <= 25 && stockPercentage > 0;
    const isWarning = stockPercentage > 25 && stockPercentage <= 50;
    
    // Determine email styling based on severity
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

    // Build additional details section
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
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${icon} ${title}</h1>
            <p style="color: rgba(255,255,255,0.95); margin: 10px 0 0 0; font-size: 16px;">${severity} Priority</p>
          </div>

          <!-- Main Content -->
          <div style="background: white; padding: 30px; border: 2px solid ${color}; border-top: none; border-radius: 0 0 12px 12px;">
            
            <!-- Urgency Message -->
            <p style="font-size: 16px; line-height: 1.6; color: #374151; margin: 0 0 20px 0;">
              ${urgencyMessage}
            </p>

            <!-- Stock Details Card -->
            <div style="background: ${bgColor}; border-left: 6px solid ${color}; padding: 25px; border-radius: 8px; margin: 25px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #374151;">
                    <strong style="font-size: 15px;">Item Name:</strong>
                  </td>
                  <td style="padding: 8px 0; text-align: right; color: #111827; font-weight: 600;">
                    ${itemName}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #374151;">
                    <strong style="font-size: 15px;">Current Stock:</strong>
                  </td>
                  <td style="padding: 8px 0; text-align: right;">
                    <span style="color: ${color}; font-weight: bold; font-size: 18px;">${currentStock} ${unit}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #374151;">
                    <strong style="font-size: 15px;">Minimum Required:</strong>
                  </td>
                  <td style="padding: 8px 0; text-align: right; color: #111827; font-weight: 600;">
                    ${minStock} ${unit}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #374151;">
                    <strong style="font-size: 15px;">Stock Level:</strong>
                  </td>
                  <td style="padding: 8px 0; text-align: right;">
                    <span style="color: ${color}; font-weight: bold;">${Math.round(stockPercentage)}% of minimum</span>
                  </td>
                </tr>
              </table>

              ${isCritical ? `
                <div style="margin-top: 20px; padding: 15px; background: rgba(220, 38, 38, 0.1); border-radius: 6px; border: 2px dashed ${color};">
                  <p style="margin: 0; color: ${color}; font-weight: bold; font-size: 14px; text-align: center;">
                    ⚠️ IMMEDIATE REORDER REQUIRED ⚠️
                  </p>
                </div>
              ` : ''}
            </div>

            ${additionalInfo}

            <!-- Action Items -->
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

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0 20px 0;">
              <a href="${FRONTEND_URL}/consumables" style="display: inline-block; padding: 16px 40px; background-color: ${color}; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                ${actionText}
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 20px 0 0 0;">
              Click above to access the inventory management system
            </p>
          </div>

          <!-- Footer -->
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

    console.log(`✅ Low stock alert email sent to: ${to} (${itemName}: ${currentStock}/${minStock} - ${severity})`);
    return data;
  } catch (error) {
    console.error('❌ Failed to send low stock alert email:', error);
    return null;
  }
}

// Initialize check
if (resend && process.env.RESEND_API_KEY) {
  console.log('✅ Resend email service initialized');
} else {
  console.warn('⚠️ RESEND_API_KEY not found - email notifications disabled');
  console.warn('   Set RESEND_API_KEY in Railway environment variables to enable emails');
}
