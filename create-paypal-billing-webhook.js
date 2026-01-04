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

async function listWebhooks(token) {
  const res = await fetch(`${getApiBaseUrl()}/v1/notifications/webhooks`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal list webhooks failed: ${res.status} ${res.statusText} :: ${text}`);
  }

  const json = await res.json();
  return json.webhooks || [];
}

async function createWebhook(token, url, eventTypes) {
  const res = await fetch(`${getApiBaseUrl()}/v1/notifications/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      event_types: eventTypes.map((name) => ({ name })),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal create webhook failed: ${res.status} ${res.statusText} :: ${text}`);
  }

  return res.json();
}

async function main() {
  const liveBase = 'https://it-asset-project-production.up.railway.app';
  const billingWebhookUrl = `${liveBase}/api/billing/paypal/webhook`;

  const token = await getAccessToken();
  const existing = await listWebhooks(token);

  const match = existing.find((w) => String(w.url).trim() === billingWebhookUrl);
  if (match) {
    console.log(`✅ Billing webhook already exists: ${match.id}`);
    console.log(`URL: ${match.url}`);
    console.log(`Events: ${(match.event_types || []).map((e) => e.name).join(', ')}`);
    return;
  }

  // Use wildcard subscription to avoid PayPal event-name validation mismatches.
  // Our server handler filters events and only inserts real non-zero payments.
  const eventTypes = ['*'];

  const created = await createWebhook(token, billingWebhookUrl, eventTypes);

  console.log('✅ Created PayPal billing webhook');
  console.log(`ID: ${created.id}`);
  console.log(`URL: ${created.url}`);
  console.log(`Events: ${(created.event_types || []).map((e) => e.name).join(', ')}`);
}

main().catch((e) => {
  console.error('❌', e?.message || e);
  process.exit(1);
});
