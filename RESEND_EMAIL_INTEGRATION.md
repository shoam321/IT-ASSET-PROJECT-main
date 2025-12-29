# Resend Email Integration Guide

## What is Resend?

Resend is a modern email API service that makes it easy to send transactional emails from your application. It's perfect for:
- Password reset emails
- Alert notifications
- Asset assignment notifications
- License expiration reminders
- Security alerts

## Setup Instructions

### Step 1: Create Resend Account

1. Go to https://resend.com
2. Sign up for a free account (100 emails/day free)
3. Verify your email address

### Step 2: Get API Key

1. Log into Resend dashboard
2. Go to **API Keys** section
3. Click **Create API Key**
4. Give it a name like "IT Asset Tracker"
5. Copy the API key (starts with `re_`)

### Step 3: Add to Environment Variables

Add to your `.env` file in `itam-saas/Agent/`:

```env
# Resend Email Service
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=noreply@yourdomain.com
```

### Step 4: Verify Your Domain (Optional but Recommended)

For production use, verify your domain:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the DNS records Resend provides
5. Wait for verification (usually a few minutes)

**Without domain verification:** You can only send TO the email you signed up with
**With domain verification:** You can send to anyone

### Step 5: Install Resend Package

```powershell
cd itam-saas/Agent
npm install resend
```

### Step 6: Create Email Service

I'll create the email service file for you:

```javascript
// itam-saas/Agent/services/emailService.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@itasset.local';

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(to, resetToken, userName) {
  try {
    const resetUrl = \`\${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=\${resetToken}\`;
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: 'Reset Your Password - IT Asset Tracker',
      html: \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Password Reset Request</h2>
          <p>Hi \${userName},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <a href="\${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
          <p style="color: #666;">This link will expire in 1 hour.</p>
          <p style="color: #666;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #999; font-size: 12px;">IT Asset Tracker Security Team</p>
        </div>
      \`
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}

/**
 * Send asset assignment notification
 */
export async function sendAssetAssignmentEmail(to, userName, assetTag, assetType) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: \`New Asset Assigned: \${assetTag}\`,
      html: \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">🎉 New Asset Assigned</h2>
          <p>Hi \${userName},</p>
          <p>A new asset has been assigned to you:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Asset Tag:</strong> \${assetTag}</p>
            <p style="margin: 5px 0;"><strong>Type:</strong> \${assetType}</p>
          </div>
          <p>Please take care of this equipment and report any issues to IT support.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #999; font-size: 12px;">IT Asset Management System</p>
        </div>
      \`
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}

/**
 * Send security alert email
 */
export async function sendSecurityAlertEmail(to, alertType, details) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: \`🚨 Security Alert: \${alertType}\`,
      html: \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ef4444;">⚠️ Security Alert</h2>
          <p>A security issue has been detected:</p>
          <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Alert Type:</strong> \${alertType}</p>
            <p style="margin: 5px 0;"><strong>Details:</strong> \${details}</p>
          </div>
          <p>Please review and take appropriate action.</p>
          <a href="\${process.env.FRONTEND_URL || 'http://localhost:3000'}/security-alerts" style="display: inline-block; padding: 12px 24px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Alert</a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #999; font-size: 12px;">IT Security Team</p>
        </div>
      \`
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}

/**
 * Send license expiration reminder
 */
export async function sendLicenseExpirationEmail(to, licenseName, expirationDate, daysRemaining) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: to,
      subject: \`License Expiring Soon: \${licenseName}\`,
      html: \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">⏰ License Expiration Notice</h2>
          <p>This is a reminder that a software license is expiring soon:</p>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>License:</strong> \${licenseName}</p>
            <p style="margin: 5px 0;"><strong>Expires:</strong> \${expirationDate}</p>
            <p style="margin: 5px 0;"><strong>Days Remaining:</strong> \${daysRemaining}</p>
          </div>
          <p>Please renew this license before it expires to avoid service interruption.</p>
          <a href="\${process.env.FRONTEND_URL || 'http://localhost:3000'}/licenses" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Licenses</a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #999; font-size: 12px;">IT Asset Management System</p>
        </div>
      \`
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}
```

### Step 7: Use in Your Application

Example usage in your server:

```javascript
// In server.js or routes
import * as emailService from './services/emailService.js';

// Send password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await findUserByEmail(email);
    
    if (user) {
      const resetToken = generateResetToken();
      await emailService.sendPasswordResetEmail(email, resetToken, user.username);
    }
    
    res.json({ message: 'If email exists, reset link sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Notify on asset assignment
app.put('/api/assets/:id/assign', async (req, res) => {
  try {
    const asset = await updateAsset(req.params.id, req.body);
    
    if (req.body.assigned_user_email) {
      await emailService.sendAssetAssignmentEmail(
        req.body.assigned_user_email,
        req.body.assigned_user_name,
        asset.asset_tag,
        asset.asset_type
      );
    }
    
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Email Templates Available

1. **Password Reset** - Secure password reset with expiring token
2. **Asset Assignment** - Notify users when assets are assigned
3. **Security Alerts** - Critical security notifications
4. **License Expiration** - Automated renewal reminders

## Testing

### Test in Development

For testing without domain verification, send to your signup email:

```javascript
await emailService.sendPasswordResetEmail(
  'your-signup@email.com',  // Must be YOUR email
  'test-token-123',
  'Test User'
);
```

### Test in Production

After domain verification, you can send to anyone:

```javascript
await emailService.sendAssetAssignmentEmail(
  'employee@company.com',
  'John Doe',
  'LAPTOP-001',
  'Laptop'
);
```

## Pricing

- **Free Tier**: 100 emails/day, 3,000/month
- **Pro**: $20/month for 50,000 emails
- **Scale**: Custom pricing

For most small to medium IT departments, the free tier is sufficient.

## Best Practices

1. **Always use environment variables** for API keys
2. **Verify domain** for production use
3. **Add unsubscribe links** for marketing emails (not needed for transactional)
4. **Monitor delivery** in Resend dashboard
5. **Handle errors gracefully** - don't fail requests if email fails
6. **Rate limit** to avoid hitting limits

## Security Notes

- ✅ Never commit API keys to git
- ✅ Use HTTPS in production
- ✅ Validate email addresses before sending
- ✅ Implement rate limiting on email endpoints
- ✅ Use short-lived tokens for password resets

## Support

- Documentation: https://resend.com/docs
- Dashboard: https://resend.com/home
- Support: support@resend.com

---

**Ready to integrate?** Add your API key to `.env` and restart your backend!
