import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

import { validateQuery } from './itam-saas/Agent/schema-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

function toCsvValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function listPayingCustomers() {
  await validateQuery('organizations', [
    'id',
    'name',
    'paypal_subscription_id',
    'subscription_status',
    'subscription_started_at',
    'subscription_current_period_end',
    'billing_tier',
    'plan',
  ]);
  await validateQuery('auth_users', ['organization_id', 'org_role', 'email', 'full_name']);
  await validateQuery('payments', ['organization_id', 'amount', 'currency', 'status', 'created_at']);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query(`
      WITH successful_payments AS (
        SELECT
          p.organization_id,
          p.amount,
          p.currency,
          p.status,
          p.created_at
        FROM payments p
        WHERE p.organization_id IS NOT NULL
          AND p.amount > 0
          AND (
            LOWER(COALESCE(p.status, '')) IN ('completed', 'approved', 'paid', 'succeeded', 'success')
            OR p.status ILIKE '%COMPLETED%'
            OR p.status ILIKE '%APPROVED%'
            OR p.status ILIKE '%PAID%'
            OR p.status ILIKE '%SUCCEEDED%'
            OR p.status ILIKE '%SUCCESS%'
          )
      ),
      paid_orgs AS (
        SELECT DISTINCT organization_id
        FROM successful_payments
      )
      SELECT
        o.id AS organization_id,
        o.name AS organization_name,
        o.plan,
        o.billing_tier,
        o.subscription_status,
        o.paypal_subscription_id,
        o.subscription_started_at,
        o.subscription_current_period_end,
        au.email AS owner_email,
        au.full_name AS owner_full_name,
        COALESCE(pstats.total_paid, 0) AS total_paid,
        COALESCE(pstats.payment_count, 0) AS payment_count,
        pstats.last_payment_at
      FROM paid_orgs po
      JOIN organizations o ON o.id = po.organization_id
      LEFT JOIN auth_users au
        ON au.organization_id = o.id
       AND au.org_role = 'owner'
      LEFT JOIN (
        SELECT
          organization_id,
          COUNT(*) AS payment_count,
          SUM(amount) AS total_paid,
          MAX(created_at) AS last_payment_at
        FROM successful_payments
        GROUP BY organization_id
      ) pstats ON pstats.organization_id = o.id
      ORDER BY
        pstats.last_payment_at DESC NULLS LAST,
        o.subscription_started_at DESC NULLS LAST,
        o.name ASC;
    `);

    console.log('\n💳 Paying customers (successful payments only)\n');

    if (result.rows.length === 0) {
      const paymentsNonZero = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM payments
        WHERE amount > 0;
      `);
      const paymentsSuccessfulNonZero = await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM payments
        WHERE amount > 0
          AND (
            LOWER(COALESCE(status, '')) IN ('completed', 'approved', 'paid', 'succeeded', 'success')
            OR status ILIKE '%COMPLETED%'
            OR status ILIKE '%APPROVED%'
            OR status ILIKE '%PAID%'
            OR status ILIKE '%SUCCEEDED%'
            OR status ILIKE '%SUCCESS%'
          );
      `);

      console.log('❌ No paying customers found (by current criteria).');
      console.log(`   Payments with amount > 0: ${paymentsNonZero.rows[0]?.count ?? 0}`);
      console.log(`   Payments with amount > 0 AND successful status: ${paymentsSuccessfulNonZero.rows[0]?.count ?? 0}`);
      return;
    }

    result.rows.forEach((row, index) => {
      console.log(
        `${index + 1}. ${row.organization_name} (org_id=${row.organization_id})\n` +
          `   Owner: ${row.owner_email || 'N/A'}${row.owner_full_name ? ` (${row.owner_full_name})` : ''}\n` +
          `   Plan: ${row.plan || 'N/A'} | Tier: ${row.billing_tier || 'N/A'}\n` +
          `   Subscription: ${row.subscription_status || 'N/A'} | PayPal Sub ID: ${row.paypal_subscription_id || 'N/A'}\n` +
          `   Total Paid: ${row.total_paid} | Payments: ${row.payment_count} | Last Payment: ${row.last_payment_at || 'N/A'}\n` +
          `   Next Billing: ${row.subscription_current_period_end || 'N/A'}\n`
      );
    });

    const headers = [
      'organization_id',
      'organization_name',
      'owner_email',
      'owner_full_name',
      'plan',
      'billing_tier',
      'subscription_status',
      'paypal_subscription_id',
      'subscription_started_at',
      'subscription_current_period_end',
      'payment_count',
      'total_paid',
      'last_payment_at',
    ];

    const lines = [headers.join(',')];
    for (const row of result.rows) {
      lines.push(headers.map((h) => toCsvValue(row[h])).join(','));
    }

    const outPath = path.join(__dirname, 'paying-customers.csv');
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
    console.log(`\n✅ Wrote export: ${outPath}`);
  } finally {
    await pool.end();
  }
}

listPayingCustomers().catch((error) => {
  console.error('❌ Error listing paying customers:', error?.message || error);
  process.exit(1);
});
