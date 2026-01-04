import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, 'itam-saas', 'Agent', '.env') });

function getApiBaseUrl() {
  const mode = String(process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function getAccessToken() {
  const clientId = requireEnv('PAYPAL_CLIENT_ID');
  const clientSecret = requireEnv('PAYPAL_CLIENT_SECRET');

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${getApiBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal token request failed: ${res.status} ${res.statusText} :: ${text}`);
  }

  const json = await res.json();
  return json.access_token;
}

async function main() {
  const webhookId = requireEnv('PAYPAL_WEBHOOK_ID');
  const token = await getAccessToken();

  const res = await fetch(`${getApiBaseUrl()}/v1/notifications/webhooks/${encodeURIComponent(webhookId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal webhook GET failed: ${res.status} ${res.statusText} :: ${text}`);
  }

  const json = await res.json();

  console.log(`\n🔧 PayPal webhook config (${String(process.env.PAYPAL_MODE || 'sandbox').toLowerCase()})`);
  console.log(`Webhook ID: ${webhookId}`);
  console.log(`URL: ${json.url}`);

  const events = (json.event_types || []).map((e) => e.name).sort();
  console.log(`Event types (${events.length}):`);
  events.forEach((e) => console.log(`- ${e}`));

  const mustHave = [
    'PAYMENT.CAPTURE.COMPLETED',
    'CHECKOUT.ORDER.COMPLETED',
    'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED',
  ];
  console.log('\nRequired for proper payment inserts:');
  mustHave.forEach((e) => {
    console.log(`- ${e}: ${events.includes('*') || events.includes(e) ? '✅ present' : '❌ missing'}`);
  });
}

main().catch((e) => {
  console.error('❌', e?.message || e);
  process.exit(1);
});
