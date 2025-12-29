/**
 * LICENSE EXPIRATION CHECKER
 * Runs daily to check for expiring licenses and send reminder emails
 */

import pool from './db.js';
import * as emailService from './emailService.js';

/**
 * Check for expiring licenses and send notifications
 * Sends reminders at 30, 14, 7, and 1 day before expiration
 */
export async function checkExpiringLicenses() {
  try {
    console.log('📅 Checking for expiring licenses...');

    const query = `
      SELECT 
        l.id,
        l.software_name,
        l.expiration_date,
        l.user_id,
        u.email,
        u.username as user_name,
        (l.expiration_date::date - CURRENT_DATE) as days_remaining
      FROM licenses l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.expiration_date IS NOT NULL
        AND l.expiration_date::date > CURRENT_DATE
        AND (l.expiration_date::date - CURRENT_DATE) IN (30, 14, 7, 3, 1)
      ORDER BY l.expiration_date ASC
    `;

    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('✅ No licenses expiring soon');
      return;
    }

    console.log(`📧 Found ${result.rows.length} licenses expiring soon`);

    // Send emails for each expiring license
    for (const license of result.rows) {
      const recipientEmail = license.email || process.env.ADMIN_EMAIL;
      const recipientName = license.user_name || 'Admin';

      if (recipientEmail && recipientEmail !== 'noreply@itasset.local') {
        try {
          await emailService.sendLicenseExpirationEmail(
            recipientEmail,
            license.software_name,
            license.expiration_date,
            Math.floor(license.days_remaining)
          );
          console.log(`✅ Expiration email sent for ${license.software_name} to ${recipientEmail}`);
        } catch (error) {
          console.error(`❌ Failed to send expiration email for ${license.software_name}:`, error);
        }
      }
    }

    return result.rows.length;
  } catch (error) {
    console.error('❌ Error checking expiring licenses:', error);
    throw error;
  }
}

/**
 * Start the license expiration checker (runs daily at 9 AM)
 */
export function startLicenseExpirationChecker() {
  // Run immediately on startup
  checkExpiringLicenses().catch(err => 
    console.error('License expiration check failed:', err)
  );

  // Then run every 24 hours (86400000 ms)
  const interval = setInterval(() => {
    checkExpiringLicenses().catch(err => 
      console.error('License expiration check failed:', err)
    );
  }, 24 * 60 * 60 * 1000);

  console.log('✅ License expiration checker started (runs daily)');

  return interval;
}

/**
 * Stop the license expiration checker
 */
export function stopLicenseExpirationChecker(interval) {
  if (interval) {
    clearInterval(interval);
    console.log('🛑 License expiration checker stopped');
  }
}
