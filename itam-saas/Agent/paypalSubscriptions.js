import axios from 'axios';

const PAYPAL_MODE = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();

function getPayPalApiBase() {
  return PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

let cachedToken = null;
let cachedTokenExpiresAtMs = 0;

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PayPal client credentials are not configured');
  }

  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAtMs && now < cachedTokenExpiresAtMs) {
    return cachedToken;
  }

  const apiBase = getPayPalApiBase();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await axios.post(
    `${apiBase}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    }
  );

  const token = response?.data?.access_token;
  const expiresIn = Number(response?.data?.expires_in || 0);
  if (!token) {
    throw new Error('Failed to obtain PayPal access token');
  }

  cachedToken = token;
  cachedTokenExpiresAtMs = now + Math.max(0, (expiresIn - 60)) * 1000;
  return token;
}

export async function getSubscription(subscriptionId) {
  if (!subscriptionId) throw new Error('subscriptionId is required');
  const apiBase = getPayPalApiBase();
  const token = await getAccessToken();

  const response = await axios.get(`${apiBase}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  return response.data;
}
