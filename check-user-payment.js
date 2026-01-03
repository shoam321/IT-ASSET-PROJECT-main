import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'itam-saas', 'Agent', '.env') });

const { Pool } = pg;

async function checkUserPayment() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Get user info
    const userResult = await pool.query(`
      SELECT id, email, organization_id, org_role 
      FROM auth_users 
      WHERE email = $1
    `, ['shoamtaitler@gmail.com']);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      await pool.end();
      return;
    }
    
    const user = userResult.rows[0];
    console.log('\n👤 User:', user.email);
    console.log('Organization ID:', user.organization_id);
    console.log('Role:', user.org_role);
    
    // Get organization subscription info
    const orgResult = await pool.query(`
      SELECT 
        name,
        paypal_subscription_id,
        subscription_status,
        subscription_started_at,
        subscription_current_period_end,
        billing_tier,
        plan
      FROM organizations 
      WHERE id = $1
    `, [user.organization_id]);
    
    if (orgResult.rows.length > 0) {
      const org = orgResult.rows[0];
      console.log('\n🏢 Organization:', org.name);
      console.log('Plan:', org.plan);
      console.log('Billing Tier:', org.billing_tier);
      console.log('PayPal Subscription ID:', org.paypal_subscription_id || 'None');
      console.log('Subscription Status:', org.subscription_status || 'None');
      console.log('Started:', org.subscription_started_at);
      console.log('Next Billing:', org.subscription_current_period_end);
    }
    
    // Get payment history
    const paymentsResult = await pool.query(`
      SELECT 
        payment_type,
        plan_type,
        amount,
        currency,
        status,
        paypal_subscription_id,
        paypal_order_id,
        created_at
      FROM payments 
      WHERE organization_id = $1 
      ORDER BY created_at DESC
    `, [user.organization_id]);
    
    console.log('\n💳 Payment History:');
    if (paymentsResult.rows.length === 0) {
      console.log('No payments found');
    } else {
      paymentsResult.rows.forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.payment_type} - ${p.plan_type}`);
        console.log(`   Amount: ${p.amount} ${p.currency}`);
        console.log(`   Status: ${p.status}`);
        console.log(`   Subscription ID: ${p.paypal_subscription_id || 'N/A'}`);
        console.log(`   Order ID: ${p.paypal_order_id || 'N/A'}`);
        console.log(`   Date: ${p.created_at}`);
      });
    }
    
    // Determine charging type
    console.log('\n📊 CHARGING TYPE:');
    if (orgResult.rows[0]?.paypal_subscription_id) {
      console.log('✅ MONTHLY RECURRING - Active subscription');
      console.log(`   Next charge: ${orgResult.rows[0].subscription_current_period_end}`);
    } else {
      console.log('⚠️ ONE-TIME PAYMENT - No active subscription');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkUserPayment();
