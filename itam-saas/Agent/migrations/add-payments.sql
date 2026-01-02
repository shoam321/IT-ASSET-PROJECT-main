-- Payments and PayPal webhook persistence

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

-- If a legacy payments table exists, patch it to the expected schema.
-- We intentionally avoid NOT NULL migrations here to prevent failures on existing rows.
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS capture_id TEXT;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS amount_cents BIGINT;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10);
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS status VARCHAR(32);
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS intent VARCHAR(16) DEFAULT 'CAPTURE';
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS payer_email TEXT;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure uniqueness needed for ON CONFLICT(order_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_id_unique ON payments(order_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  status VARCHAR(32) DEFAULT 'received',
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_capture_id ON payments(capture_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);

-- Updated at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'payments_set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION payments_set_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'payments_set_updated_at_trg'
  ) THEN
    CREATE TRIGGER payments_set_updated_at_trg
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION payments_set_updated_at();
  END IF;
END $$ LANGUAGE plpgsql;

-- Optional RLS (keep permissive for admins while scoping to user_id when set)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_select_policy'
  ) THEN
    CREATE POLICY payments_select_policy ON payments
      FOR SELECT
      USING (
        -- allow access when user_id matches app.current_user_id or when user_id is null (admin/system events)
        (user_id IS NULL) OR (user_id = current_setting('app.current_user_id', TRUE)::INTEGER)
      );
  END IF;
END $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_insert_policy'
  ) THEN
    CREATE POLICY payments_insert_policy ON payments
      FOR INSERT
      WITH CHECK (
        (user_id IS NULL) OR (user_id = current_setting('app.current_user_id', TRUE)::INTEGER)
      );
  END IF;
END $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_update_policy'
  ) THEN
    CREATE POLICY payments_update_policy ON payments
      FOR UPDATE
      USING (
        (user_id IS NULL) OR (user_id = current_setting('app.current_user_id', TRUE)::INTEGER)
      );
  END IF;
END $$ LANGUAGE plpgsql;

-- Webhook events are system-level; allow app role to log and read for auditing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'webhook_events' AND policyname = 'webhook_events_all'
  ) THEN
    CREATE POLICY webhook_events_all ON webhook_events
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$ LANGUAGE plpgsql;

COMMENT ON TABLE payments IS 'Payment orders and captures (PayPal)';
COMMENT ON TABLE webhook_events IS 'Inbound webhook audit trail (PayPal and others)';
