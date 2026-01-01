import 'dotenv/config';
import pg from 'pg';

// Use DATABASE_OWNER_URL if available (for schema changes), otherwise fallback
const ownerDsn = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;

if (!ownerDsn) {
  console.error('❌ DATABASE_URL or DATABASE_OWNER_URL is required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: ownerDsn });

async function addOrganizationIdColumn() {
  console.log('🔄 Adding organization_id column to assets table...\n');
  
  try {
    // Check if column exists
    const checkResult = await pool.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'assets' 
        AND column_name = 'organization_id'
    `);
    
    if (checkResult.rowCount > 0) {
      console.log('✅ organization_id column already exists on assets table');
      return true;
    }
    
    // Add the column
    await pool.query(`
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)
    `);
    console.log('✅ Added organization_id column to assets table');
    
    // Create index for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_assets_organization_id ON assets(organization_id)
    `);
    console.log('✅ Created index on organization_id');
    
    // Verify
    const verifyResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'assets' 
        AND column_name = 'organization_id'
    `);
    
    if (verifyResult.rowCount > 0) {
      console.log('\n✅ Verified: organization_id column exists');
      console.log('   Type:', verifyResult.rows[0].data_type);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('must be owner')) {
      console.log('\n⚠️ Permission denied. You need to set DATABASE_OWNER_URL with owner credentials.');
      console.log('   Get the owner credentials from Railway PostgreSQL dashboard.');
      console.log('\n   Or run this SQL manually as the database owner:');
      console.log('   ALTER TABLE assets ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);');
      console.log('   CREATE INDEX IF NOT EXISTS idx_assets_organization_id ON assets(organization_id);');
    }
    
    return false;
  } finally {
    await pool.end();
  }
}

addOrganizationIdColumn();
