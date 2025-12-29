require('dotenv').config({ path: './itam-saas/Agent/.env' });
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  try {
    console.log('Sending test email...');
    console.log('From: IT Asset Management <onboarding@resend.dev>');
    console.log('To:', process.env.ADMIN_EMAIL);
    
    const data = await resend.emails.send({
      from: 'IT Asset Management <onboarding@resend.dev>',
      to: ['tjh852321@gmail.com'], // Your registered Resend email
      subject: 'Test Email - IT Asset Management',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from your IT Asset Management system.</p>
        <p>If you received this, your email configuration is working correctly!</p>
        <hr>
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `
    });

    console.log('✅ Email sent successfully!');
    console.log('Email ID:', data.id);
    console.log('Full response:', data);
  } catch (error) {
    console.error('❌ Error sending email:');
    console.error('Error message:', error.message);
    console.error('Full error:', error);
  }
}

testEmail();
