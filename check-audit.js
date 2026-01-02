const pg = require('pg');
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='audit_logs'");
  console.log('audit_logs columns:', r.rows.map(x => x.column_name));
  await pool.end();
}

check().catch(e => { console.error(e); pool.end(); });
