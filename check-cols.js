const pg = require('pg');
const p = new pg.Pool({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const cols = await p.query(`SELECT column_name FROM information_schema.columns WHERE table_name='security_alerts'`);
  console.log('security_alerts columns:', cols.rows.map(x => x.column_name).join(', '));
  
  const devCols = await p.query(`SELECT column_name FROM information_schema.columns WHERE table_name='devices'`);
  console.log('devices columns:', devCols.rows.map(x => x.column_name).join(', '));
  
  const payCols = await p.query(`SELECT column_name FROM information_schema.columns WHERE table_name='payments'`);
  console.log('payments columns:', payCols.rows.map(x => x.column_name).join(', '));
  
  await p.end();
}
check();
