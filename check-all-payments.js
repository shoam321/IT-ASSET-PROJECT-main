import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'itam-saas', 'Agent', '.env') });

const { Pool } = pg;

async function checkAllPaymentSources() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('\n🔍 Checking ALL payment-related tables...\n');
    
    // Check payments table
    const payments = await pool.query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 10');
    console.log(`📊 Payments table: ${payments.rows.length} records`);
    if (payments.rows.length > 0) {
      payments.rows.forEach(p => {
        console.log(`   - ${p.amount} ${p.currency} | ${p.status} | ${p.created_at}`);
      });
    }
    
    // Check subscriptions table
    const subs = await pool.query('SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 10');
    console.log(`\n📊 Subscriptions table: ${subs.rows.length} records`);
    if (subs.rows.length > 0) {
      subs.rows.forEach(s => {
        console.log(`   - Status: ${s.status} | PayPal ID: ${s.paypal_subscription_id} | ${s.created_at}`);
      });
    }
    
    // Check webhook_events
    const webhooks = await pool.query(`
      SELECT event_type, created_at, payload 
      FROM webhook_events 
      WHERE event_type LIKE '%PAYMENT%' OR event_type LIKE '%SUBSCRIPTION%'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log(`\n📊 Webhook events (payment-related): ${webhooks.rows.length} records`);
    if (webhooks.rows.length > 0) {
      webhooks.rows.forEach(w => {
        console.log(`   - ${w.event_type} | ${w.created_at}`);
      });
    }
    
    // Check organizations with subscription data
    const orgs = await pool.query(`
      SELECT 
        id, name, paypal_subscription_id, subscription_status, 
        subscription_started_at, subscription_current_period_end
      FROM organizations 
      WHERE paypal_subscription_id IS NOT NULL 
      ORDER BY subscription_started_at DESC
    `);
    console.log(`\n📊 Organizations with PayPal subscriptions: ${orgs.rows.length}`);
    if (orgs.rows.length > 0) {
      orgs.rows.forEach(o => {
        console.log(`   - ${o.name} | ${o.subscription_status} | Sub ID: ${o.paypal_subscription_id}`);
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkAllPaymentSources();
