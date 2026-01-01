import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const r = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'assets' AND column_name = 'organization_id'
  `);
  console.log('organization_id column exists:', r.rowCount > 0);
  
  if (r.rowCount === 0) {
    console.log('\n❌ Column missing! Run this SQL in Railway PostgreSQL console:\n');
    console.log('ALTER TABLE assets ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);');
    console.log('CREATE INDEX IF NOT EXISTS idx_assets_organization_id ON assets(organization_id);');
  }
  
  await pool.end();
}

check();
