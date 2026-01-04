import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the same env file the rest of the repo uses
dotenv.config({ path: path.join(__dirname, 'itam-saas', 'Agent', '.env') });

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function getAccessToken() {
  const clientId = requireEnv('PAYPAL_CLIENT_ID');
  const clientSecret = requireEnv('PAYPAL_CLIENT_SECRET');

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
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

async function listSubscriptionTransactions(subscriptionId) {
  const token = await getAccessToken();

  // Look back 45 days by default
  const end = new Date();
  const start = new Date(end.getTime() - 45 * 24 * 60 * 60 * 1000);

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const url = new URL(`https://api-m.paypal.com/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/transactions`);
  url.searchParams.set('start_time', startIso);
  url.searchParams.set('end_time', endIso);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal transactions request failed: ${res.status} ${res.statusText} :: ${text}`);
  }

  const json = await res.json();
  const txns = json.transactions || [];

  console.log(`\n💳 PayPal subscription transactions (last 45 days)`);
  console.log(`Subscription ID: ${subscriptionId}`);
  console.log(`Range: ${startIso} → ${endIso}`);
  console.log(`Transactions: ${txns.length}\n`);

  txns.slice(0, 20).forEach((t, idx) => {
    const amt = t?.amount_with_breakdown?.gross_amount?.value ?? t?.amount_with_breakdown?.gross_amount?.amount?.value;
    const cur = t?.amount_with_breakdown?.gross_amount?.currency_code;
    const status = t?.status;
    const time = t?.time;
    const id = t?.id;
    console.log(`${idx + 1}. ${status || 'N/A'} | ${amt ?? 'N/A'} ${cur ?? ''} | ${time || 'N/A'} | txn_id=${id || 'N/A'}`);
  });

  if (txns.length > 20) {
    console.log(`\n… plus ${txns.length - 20} more (not shown)`);
  }
}

const subscriptionId = process.argv[2] || 'I-2JT6KE8JG254';

listSubscriptionTransactions(subscriptionId).catch((e) => {
  console.error('❌', e?.message || e);
  process.exit(1);
});
