// Create missing payments table
import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function createPaymentsTable() {
  await client.connect();
  console.log('Connected\n');

  // Create payments table
  await client.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES auth_users(id),
      organization_id INTEGER REFERENCES organizations(id),
      paypal_subscription_id VARCHAR(255),
      paypal_order_id VARCHAR(255),
      amount DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'USD',
      status VARCHAR(50) DEFAULT 'pending',
      payment_type VARCHAR(50),
      plan_type VARCHAR(50),
      description TEXT,
      paypal_payer_id VARCHAR(255),
      paypal_payer_email VARCHAR(255),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Created payments table');

  // Create subscriptions table if missing
  await client.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES auth_users(id),
      organization_id INTEGER REFERENCES organizations(id),
      paypal_subscription_id VARCHAR(255) UNIQUE,
      plan_id VARCHAR(255),
      plan_type VARCHAR(50) DEFAULT 'free',
      status VARCHAR(50) DEFAULT 'active',
      current_period_start TIMESTAMP,
      current_period_end TIMESTAMP,
      canceled_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Created subscriptions table');

  // Create indexes
  await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON payments(organization_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal_id ON subscriptions(paypal_subscription_id)`);
  console.log('✅ Created indexes');

  // Verify
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name IN ('payments', 'subscriptions')
    ORDER BY table_name
  `);
  console.log('\nVerified tables:', tables.rows.map(r => r.table_name).join(', '));

  await client.end();
  console.log('\nDone!');
}

createPaymentsTable().catch(e => { console.error(e); process.exit(1); });
