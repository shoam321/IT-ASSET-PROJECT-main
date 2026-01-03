import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'itam-saas', 'Agent', '.env') });

const { Pool } = pg;

async function findPaidUsers() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const result = await pool.query(`
      SELECT 
        au.email,
        au.full_name,
        o.name as org_name,
        o.paypal_subscription_id,
        o.subscription_status,
        o.subscription_current_period_end,
        COUNT(p.id) as payment_count,
        SUM(p.amount) as total_paid
      FROM payments p
      JOIN organizations o ON p.organization_id = o.id
      LEFT JOIN auth_users au ON o.id = au.organization_id AND au.org_role = 'owner'
      GROUP BY au.email, au.full_name, o.name, o.paypal_subscription_id, o.subscription_status, o.subscription_current_period_end
      ORDER BY total_paid DESC
    `);
    
    console.log('\n💰 Users with Payments:\n');
    
    if (result.rows.length === 0) {
      console.log('❌ No payments found in system');
    } else {
      result.rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.email || 'No owner email'} (${row.org_name})`);
        console.log(`   Total Paid: $${row.total_paid}`);
        console.log(`   Payments: ${row.payment_count}`);
        console.log(`   Subscription: ${row.paypal_subscription_id ? '✅ MONTHLY' : '❌ One-time'}`);
        console.log(`   Status: ${row.subscription_status || 'N/A'}`);
        console.log(`   Next Billing: ${row.subscription_current_period_end || 'N/A'}\n`);
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

findPaidUsers();
