// Test all Grafana dashboard queries
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const queries = {
  'Total Assets': 'SELECT COUNT(*) as count FROM assets;',
  'Total Users': 'SELECT COUNT(*) as count FROM auth_users WHERE is_active = true;',
  'Total Licenses': 'SELECT COUNT(*) as count FROM licenses;',
  'Low Stock Alert': 'SELECT COUNT(*) as count FROM consumables WHERE quantity <= min_quantity;',
  'Assets by Category': `SELECT COALESCE(category, 'Uncategorized') as category, COUNT(*) as count 
                         FROM assets GROUP BY category ORDER BY count DESC LIMIT 10;`,
  'Assets by Status': `SELECT COALESCE(status, 'Unknown') as status, COUNT(*) as count 
                       FROM assets GROUP BY status ORDER BY count DESC;`,
  'Low Stock Items': `SELECT name, quantity, min_quantity as min_qty, (min_quantity - quantity) as shortage 
                      FROM consumables WHERE quantity <= min_quantity 
                      ORDER BY shortage DESC LIMIT 20;`,
  'Recent Assets': `SELECT asset_tag, asset_type, manufacturer, status, created_at 
                    FROM assets ORDER BY created_at DESC LIMIT 20;`,
  'License Expirations': `SELECT software_name, license_key, expiration_date,
                          CASE 
                            WHEN expiration_date < CURRENT_DATE THEN 'Expired'
                            WHEN expiration_date < CURRENT_DATE + INTERVAL '30 days' THEN 'Expiring Soon'
                            ELSE 'Active' 
                          END as status
                          FROM licenses WHERE expiration_date IS NOT NULL 
                          ORDER BY expiration_date ASC LIMIT 20;`,
  'Asset Value Trend': `SELECT DATE_TRUNC('day', created_at)::date as date, COUNT(*) as count 
                        FROM assets WHERE created_at >= NOW() - INTERVAL '30 days' 
                        GROUP BY DATE_TRUNC('day', created_at) 
                        ORDER BY date ASC;`
};

async function testQueries() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing all dashboard queries...\n');
    
    for (const [name, query] of Object.entries(queries)) {
      try {
        const result = await client.query(query);
        console.log(`✅ ${name}`);
        console.log(`   Rows: ${result.rows.length}`);
        if (result.rows.length > 0) {
          console.log(`   Sample: ${JSON.stringify(result.rows[0])}`);
        }
        console.log();
      } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${error.message}`);
        console.log();
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

testQueries().catch(console.error);
