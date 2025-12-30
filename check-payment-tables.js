const pg = require('pg');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://itam_app:secure_app_password_2025@caboose.proxy.rlwy.net:31886/railway'
});

async function checkTables() {
  try {
    await client.connect();
    const result = await client.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema='public' AND table_name IN ('payments', 'webhook_events')`
    );
    console.log('Payment tables found:');
    result.rows.forEach(row => console.log('  -', row.table_name));
    if (result.rows.length === 0) {
      console.log('  (No payment tables found)');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTables();
