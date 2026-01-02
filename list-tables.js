const pg = require('pg');
const p = new pg.Pool({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function list() {
  const tables = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
  console.log('Tables:', tables.rows.map(x => x.table_name).join(', '));
  
  const views = await p.query("SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name");
  console.log('Views:', views.rows.map(x => x.table_name).join(', '));
  
  await p.end();
}
list();
