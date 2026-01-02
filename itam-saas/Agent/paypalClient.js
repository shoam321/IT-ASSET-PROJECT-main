import paypal from '@paypal/checkout-server-sdk';

const PAYPAL_MODE = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();

let cachedClient = null;

function getClient() {
  if (cachedClient) return cachedClient;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('❌ PayPal credentials missing');
    throw new Error('PayPal client credentials are not configured');
  }

  const environment = PAYPAL_MODE === 'live'
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);

  cachedClient = new paypal.core.PayPalHttpClient(environment);
  return cachedClient;
}

export const allowedCurrencies = ['USD', 'EUR', 'GBP', 'ILS'];

export async function createOrder({ amount, currency, description, returnUrl, cancelUrl, intent = 'CAPTURE' }) {
  const client = getClient();
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent,
    purchase_units: [
      {
        amount: {
          currency_code: currency,
          value: amount
        },
        description
      }
    ],
    application_context: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
      shipping_preference: 'NO_SHIPPING'
    }
  });

  const response = await client.execute(request);
  const orderId = response?.result?.id;
  const approveUrl = response?.result?.links?.find(l => l.rel === 'approve')?.href;
  return { orderId, approveUrl, status: response?.result?.status, raw: response?.result };
}

export async function captureOrder(orderId) {
  const client = getClient();
  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  request.requestBody({});
  const response = await client.execute(request);
  const capture = response?.result?.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    status: response?.result?.status || capture?.status,
    captureId: capture?.id,
    payerEmail: response?.result?.payer?.email_address,
    payerName: response?.result?.payer?.name ? `${response.result.payer.name.given_name || ''} ${response.result.payer.name.surname || ''}`.trim() : null,
    amount: capture?.amount,
    raw: response?.result
  };
}

export async function verifyWebhookSignature(headers, body) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error('PAYPAL_WEBHOOK_ID is not configured');
  }

  const transmissionId = headers['paypal-transmission-id'];
  const timestamp = headers['paypal-transmission-time'];
  const webhookEvent = body;
  const certUrl = headers['paypal-cert-url'];
  const authAlgo = headers['paypal-auth-algo'];
  const transmissionSig = headers['paypal-transmission-sig'];

  if (!transmissionId || !timestamp || !certUrl || !authAlgo || !transmissionSig) {
    throw new Error('Missing PayPal webhook verification headers');
  }

  const client = getClient();
  const verifyRequest = new paypal.notifications.VerifyWebhookSignatureRequest();
  verifyRequest.requestBody({
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: timestamp,
    webhook_id: webhookId,
    webhook_event: webhookEvent
  });

  const response = await client.execute(verifyRequest);
  return response?.result?.verification_status === 'SUCCESS';
}
