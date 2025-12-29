-- Consumables/Inventory Management
-- Track stock levels of consumable items like cables, batteries, toner, etc.

CREATE TABLE IF NOT EXISTS consumables (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'pieces',
  unit_cost DECIMAL(10, 2) DEFAULT 0,
  location VARCHAR(255),
  supplier VARCHAR(255),
  sku VARCHAR(100),
  notes TEXT,
  user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock transactions history
CREATE TABLE IF NOT EXISTS consumable_transactions (
  id SERIAL PRIMARY KEY,
  consumable_id INTEGER NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- 'add', 'remove', 'adjustment'
  quantity_change INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  reason TEXT,
  performed_by INTEGER,
  performed_by_name VARCHAR(255),
  user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consumables_user_id ON consumables(user_id);
CREATE INDEX IF NOT EXISTS idx_consumables_category ON consumables(category);
CREATE INDEX IF NOT EXISTS idx_consumables_quantity ON consumables(quantity);
CREATE INDEX IF NOT EXISTS idx_consumable_transactions_consumable_id ON consumable_transactions(consumable_id);
CREATE INDEX IF NOT EXISTS idx_consumable_transactions_user_id ON consumable_transactions(user_id);

-- Enable RLS
ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumable_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consumables
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'consumables' AND policyname = 'consumables_select_policy'
  ) THEN
    CREATE POLICY consumables_select_policy ON consumables
      FOR SELECT
      USING (user_id = current_setting('app.current_user_id', TRUE)::INTEGER);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'consumables' AND policyname = 'consumables_insert_policy'
  ) THEN
    CREATE POLICY consumables_insert_policy ON consumables
      FOR INSERT
      WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::INTEGER);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'consumables' AND policyname = 'consumables_update_policy'
  ) THEN
    CREATE POLICY consumables_update_policy ON consumables
      FOR UPDATE
      USING (user_id = current_setting('app.current_user_id', TRUE)::INTEGER);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'consumables' AND policyname = 'consumables_delete_policy'
  ) THEN
    CREATE POLICY consumables_delete_policy ON consumables
      FOR DELETE
      USING (user_id = current_setting('app.current_user_id', TRUE)::INTEGER);
  END IF;
END $$;

-- RLS Policies for transactions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'consumable_transactions' AND policyname = 'transactions_select_policy'
  ) THEN
    CREATE POLICY transactions_select_policy ON consumable_transactions
      FOR SELECT
      USING (user_id = current_setting('app.current_user_id', TRUE)::INTEGER);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'consumable_transactions' AND policyname = 'transactions_insert_policy'
  ) THEN
    CREATE POLICY transactions_insert_policy ON consumable_transactions
      FOR INSERT
      WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::INTEGER);
  END IF;
END $$;

COMMENT ON TABLE consumables IS 'Track consumable inventory items and stock levels';
COMMENT ON TABLE consumable_transactions IS 'History of stock adjustments and transactions';
