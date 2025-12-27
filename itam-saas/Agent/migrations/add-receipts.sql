-- Digital Receipts Migration
-- Store purchase receipts, warranty documents, and invoices for assets

CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(50),
  description TEXT,
  uploaded_by INTEGER,
  uploaded_by_name VARCHAR(255),
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER -- For RLS
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_receipts_asset_id ON receipts(asset_id);
CREATE INDEX IF NOT EXISTS idx_receipts_upload_date ON receipts(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);

-- Enable Row-Level Security
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see receipts for their own data
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'receipts' AND policyname = 'receipts_select_policy'
  ) THEN
    CREATE POLICY receipts_select_policy ON receipts
      FOR SELECT
      USING (user_id = current_setting('app.current_user_id', TRUE)::INTEGER);
  END IF;
END $$;

-- Policy: Users can insert their own receipts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'receipts' AND policyname = 'receipts_insert_policy'
  ) THEN
    CREATE POLICY receipts_insert_policy ON receipts
      FOR INSERT
      WITH CHECK (user_id = current_setting('app.current_user_id', TRUE)::INTEGER);
  END IF;
END $$;

-- Policy: Users can delete their own receipts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'receipts' AND policyname = 'receipts_delete_policy'
  ) THEN
    CREATE POLICY receipts_delete_policy ON receipts
      FOR DELETE
      USING (user_id = current_setting('app.current_user_id', TRUE)::INTEGER);
  END IF;
END $$;

COMMENT ON TABLE receipts IS 'Stores digital copies of purchase receipts, warranties, and invoices for assets';
COMMENT ON COLUMN receipts.file_path IS 'Relative path to uploaded file in storage';
COMMENT ON COLUMN receipts.asset_id IS 'Links receipt to specific asset';
