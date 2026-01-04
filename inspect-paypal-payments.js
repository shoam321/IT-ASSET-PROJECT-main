import pg from 'pg';
import { validateQuery } from './itam-saas/Agent/schema-validator.js';

const { Pool } = pg;

function safeGet(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function extractAmount(payload) {
  const candidates = [
    'resource.amount.value',
    'resource.amount.total',
    'resource.billing_info.last_payment.amount.value',
    'resource.billing_info.last_payment.amount.total',
    'resource.purchase_units.0.amount.value',
    'resource.purchase_units.0.amount.breakdown.item_total.value',
  ];

  for (const c of candidates) {
    const v = safeGet(payload, c);
    if (v !== undefined) return v;
  }
  return undefined;
}

function extractCurrency(payload) {
  const candidates = [
    'resource.amount.currency_code',
    'resource.amount.currency',
    'resource.billing_info.last_payment.amount.currency_code',
    'resource.purchase_units.0.amount.currency_code',
  ];

  for (const c of candidates) {
    const v = safeGet(payload, c);
    if (v !== undefined) return v;
  }
  return undefined;
}

async function main() {
  await validateQuery('organizations', ['id', 'name', 'paypal_subscription_id', 'subscription_status', 'plan', 'billing_tier']);
  await validateQuery('webhook_events', ['event_type', 'created_at', 'payload']);
  await validateQuery('payments', ['organization_id', 'amount', 'currency', 'status', 'created_at', 'paypal_subscription_id', 'paypal_order_id']);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const orgs = await pool.query(`
      SELECT id, name, paypal_subscription_id, subscription_status, plan, billing_tier
      FROM organizations
      WHERE paypal_subscription_id IS NOT NULL
      ORDER BY id DESC;
    `);

    console.log('\n🏢 Orgs with PayPal subscription IDs:');
    if (orgs.rows.length === 0) {
      console.log('None');
      return;
    }

    for (const org of orgs.rows) {
      console.log(`- ${org.name} (org_id=${org.id}) plan=${org.plan || 'N/A'} tier=${org.billing_tier || 'N/A'} status=${org.subscription_status || 'N/A'} subId=${org.paypal_subscription_id}`);

      const payments = await pool.query(
        `
        SELECT amount, currency, status, paypal_subscription_id, paypal_order_id, created_at
        FROM payments
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT 20;
        `,
        [org.id]
      );

      const nonZero = payments.rows.filter((p) => Number(p.amount) > 0);
      console.log(`  payments rows: ${payments.rows.length} (non-zero: ${nonZero.length})`);
      if (payments.rows.length > 0) {
        const last = payments.rows[0];
        console.log(`  last payment row: amount=${last.amount} ${last.currency} status=${last.status} at=${last.created_at}`);
      }

      const events = await pool.query(
        `
        SELECT event_type, created_at, payload
        FROM webhook_events
        WHERE payload::text ILIKE '%' || $1 || '%'
        ORDER BY created_at DESC
        LIMIT 30;
        `,
        [org.paypal_subscription_id]
      );

      console.log(`  webhook events containing subId: ${events.rows.length}`);

      const summarized = events.rows.map((e) => {
        const payload = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
        const amount = extractAmount(payload);
        const currency = extractCurrency(payload);
        const status = safeGet(payload, 'resource.status') ?? safeGet(payload, 'resource.state');
        return {
          event_type: e.event_type,
          created_at: e.created_at,
          status,
          amount,
          currency,
        };
      });

      summarized.forEach((s) => {
        console.log(`    - ${s.event_type} | ${s.created_at} | status=${s.status ?? 'N/A'} | amount=${s.amount ?? 'N/A'} ${s.currency ?? ''}`);
      });

      const paymentLike = summarized.filter((s) => /PAYMENT|CAPTURE|CHECKOUT|SALE|INVOICE/i.test(s.event_type));
      console.log(`  payment-like webhook events: ${paymentLike.length}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ inspect-paypal-payments failed:', e?.message || e);
  process.exit(1);
});
