const pg = require('pg');
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const tables = ['assets', 'forbidden_apps'];
  for (const t of tables) {
    const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='${t}' ORDER BY ordinal_position`);
    console.log(`${t}:`, r.rows.map(x => x.column_name).join(', '));
  }
  await pool.end();
}
check();
