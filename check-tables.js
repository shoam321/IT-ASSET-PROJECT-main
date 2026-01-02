// Check missing tables
import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();
  console.log('Connected\n');

  // Check payments table
  const payments = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'payments' ORDER BY ordinal_position
  `);
  console.log('Payments table:', payments.rows.length > 0 ? payments.rows.map(r => r.column_name).join(', ') : 'MISSING');

  // Check security_alerts table
  const alerts = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'security_alerts' ORDER BY ordinal_position
  `);
  console.log('Security_alerts:', alerts.rows.length > 0 ? alerts.rows.map(r => r.column_name).join(', ') : 'MISSING');

  // List all tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' ORDER BY table_name
  `);
  console.log('\nAll tables (' + tables.rows.length + '):');
  tables.rows.forEach(r => console.log('  -', r.table_name));

  await client.end();
}

check().catch(e => { console.error(e); process.exit(1); });
