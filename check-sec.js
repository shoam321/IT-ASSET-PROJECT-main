const pg = require('pg');
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='security_alerts' ORDER BY ordinal_position");
  console.log('security_alerts:', r.rows.map(x => x.column_name).join(', '));
  await pool.end();
}
check();
