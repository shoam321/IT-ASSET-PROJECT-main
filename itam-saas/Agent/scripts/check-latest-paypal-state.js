import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { validateQuery } from '../schema-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000
  });

  try {
    await validateQuery('webhook_events', ['event_type', 'status', 'created_at']);
    await validateQuery('payments', [
      'created_at',
      'status',
      'amount',
      'currency',
      'payer_email',
      'paypal_order_id',
      'paypal_subscription_id',
      'organization_id'
    ]);
    await validateQuery('subscriptions', ['created_at', 'status', 'plan_type', 'paypal_subscription_id', 'organization_id']);
    await validateQuery('organizations', [
      'name',
      'billing_tier',
      'subscription_status',
      'paypal_subscription_id',
      'subscription_started_at',
      'subscription_current_period_end',
      'subscription_updated_at',
      'updated_at'
    ]);

    console.log('--- Recent webhook_events ---');
    {
      const r = await pool.query(
        'SELECT event_type, status, created_at FROM webhook_events ORDER BY created_at DESC LIMIT 10'
      );
      for (const row of r.rows) {
        console.log(`${row.created_at.toISOString()} | ${row.status} | ${row.event_type}`);
      }
    }

    console.log('--- Recent payments ---');
    {
      const r = await pool.query(
        'SELECT created_at, status, amount, currency, payer_email, paypal_order_id, paypal_subscription_id, organization_id FROM payments ORDER BY created_at DESC LIMIT 10'
      );
      for (const row of r.rows) {
        console.log(
          `${row.created_at.toISOString()} | ${row.status} | ${row.amount} ${row.currency} | ${row.payer_email || ''} | order=${row.paypal_order_id || ''} sub=${row.paypal_subscription_id || ''} org=${row.organization_id || ''}`
        );
      }
    }

    console.log('--- Recent subscriptions ---');
    {
      const r = await pool.query(
        'SELECT created_at, status, plan_type, paypal_subscription_id, organization_id FROM subscriptions ORDER BY created_at DESC LIMIT 10'
      );
      for (const row of r.rows) {
        console.log(
          `${row.created_at.toISOString()} | ${row.status} | ${row.plan_type || ''} | ${row.paypal_subscription_id || ''} | org=${row.organization_id || ''}`
        );
      }
    }

    console.log('--- Recent organizations (subscription fields) ---');
    {
      const r = await pool.query(
        'SELECT name, billing_tier, subscription_status, paypal_subscription_id, subscription_started_at, subscription_current_period_end, subscription_updated_at, updated_at FROM organizations ORDER BY updated_at DESC LIMIT 10'
      );
      for (const row of r.rows) {
        console.log(
          `${row.updated_at.toISOString()} | ${row.name} | tier=${row.billing_tier || ''} | status=${row.subscription_status || ''} | sub=${row.paypal_subscription_id || ''}`
        );
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('❌ Failed:', error?.message || error);
  process.exit(1);
});
