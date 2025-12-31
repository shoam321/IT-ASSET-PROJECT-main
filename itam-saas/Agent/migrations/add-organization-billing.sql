-- Organization Billing (Subscriptions)
-- Adds subscription metadata to organizations and allows server-side (webhook) updates safely.

-- 1) Add billing/subscription fields to organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'billing_tier'
  ) THEN
    ALTER TABLE organizations
      ADD COLUMN billing_tier VARCHAR(30) NOT NULL DEFAULT 'free',
      ADD COLUMN subscription_status VARCHAR(50) NOT NULL DEFAULT 'inactive',
      ADD COLUMN paypal_subscription_id TEXT,
      ADD COLUMN subscription_started_at TIMESTAMP,
      ADD COLUMN subscription_current_period_end TIMESTAMP,
      ADD COLUMN subscription_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_billing_tier ON organizations(billing_tier);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status ON organizations(subscription_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_paypal_subscription_id
  ON organizations(paypal_subscription_id)
  WHERE paypal_subscription_id IS NOT NULL;

-- 2) Allow system (webhook) updates via session variable app.system = '1'
-- RLS policies are additive (OR). We keep member/owner policies and add a server-side policy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizations' AND policyname = 'organizations_system_select_policy'
  ) THEN
    CREATE POLICY organizations_system_select_policy ON organizations
      FOR SELECT
      USING (
        current_setting('app.system', true) = '1'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizations' AND policyname = 'organizations_system_update_policy'
  ) THEN
    CREATE POLICY organizations_system_update_policy ON organizations
      FOR UPDATE
      USING (
        current_setting('app.system', true) = '1'
      )
      WITH CHECK (
        current_setting('app.system', true) = '1'
      );
  END IF;
END $$;
