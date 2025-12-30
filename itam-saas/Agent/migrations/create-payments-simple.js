import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function run() {
  try {
    console.log('🔄 Creating payments tables...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        capture_id TEXT,
        user_id INTEGER,
        amount_cents BIGINT NOT NULL,
        currency VARCHAR(10) NOT NULL,
        status VARCHAR(32) NOT NULL,
        intent VARCHAR(16) DEFAULT 'CAPTURE',
        payer_email TEXT,
        payer_name TEXT,
        description TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ payments table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        event_id TEXT UNIQUE NOT NULL,
        event_type TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'received',
        payload JSONB NOT NULL,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ webhook_events table created');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
      CREATE INDEX IF NOT EXISTS idx_payments_capture_id ON payments(capture_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
    `);
    console.log('✅ Indexes created');

    console.log('✅ Payments schema setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch {}
  }
}

run();
