import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const PAYPAL_MODE = process.env.PAYPAL_MODE || 'live';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

const API_BASE = PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await axios.post(`${API_BASE}/v1/oauth2/token`, 'grant_type=client_credentials', {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  return response.data.access_token;
}

async function createProduct(token) {
  console.log('\n📦 Creating Product...');
  const response = await axios.post(
    `${API_BASE}/v1/catalogs/products`,
    {
      name: 'IT Asset Management',
      description: 'IT Asset tracking and management platform for organizations',
      type: 'SERVICE',
      category: 'SOFTWARE'
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  console.log('✅ Product created:', response.data.id);
  return response.data.id;
}

async function createPlan(token, productId, planName, price) {
  console.log(`\n💰 Creating ${planName} Plan ($${price}/month)...`);
  const response = await axios.post(
    `${API_BASE}/v1/billing/plans`,
    {
      product_id: productId,
      name: planName,
      description: `${planName} - Monthly subscription for IT Asset Management`,
      billing_cycles: [
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: price.toString(),
              currency_code: 'USD'
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: '0',
          currency_code: 'USD'
        },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    }
  );
  console.log(`✅ ${planName} Plan created!`);
  console.log(`   Plan ID: ${response.data.id}`);
  console.log(`   Status: ${response.data.status}`);
  return response.data.id;
}

async function main() {
  try {
    console.log(`🚀 Creating PayPal Subscription Plans (${PAYPAL_MODE.toUpperCase()} mode)...`);
    
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      console.error('❌ Missing PayPal credentials in .env file');
      process.exit(1);
    }

    const token = await getAccessToken();
    console.log('✅ Authenticated with PayPal');

    const productId = await createProduct(token);
    
    const proPlanId = await createPlan(token, productId, 'Pro Plan', 29);
    const enterprisePlanId = await createPlan(token, productId, 'Enterprise Plan', 99);

    console.log('\n\n🎉 SUCCESS! Plans created!');
    console.log('\n📋 Add these to your environment variables:');
    console.log('\n--- Railway (Backend) ---');
    console.log(`PAYPAL_PRO_PLAN_ID=${proPlanId}`);
    console.log(`PAYPAL_ENTERPRISE_PLAN_ID=${enterprisePlanId}`);
    console.log('\n--- Vercel (Frontend) ---');
    console.log(`REACT_APP_PAYPAL_PRO_PLAN_ID=${proPlanId}`);
    console.log(`REACT_APP_PAYPAL_ENTERPRISE_PLAN_ID=${enterprisePlanId}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

main();
