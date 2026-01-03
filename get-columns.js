import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'itam-saas', 'Agent', '.env') });

const { Pool } = pg;

async function getColumns() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const tables = ['assets','licenses','users','contracts','device_usage','forbidden_apps','security_alerts','consumables','receipts','auth_users','devices','audit_logs'];
  
  try {
    for (const table of tables) {
      const result = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position`, [table]);
      console.log(`\n${table}:`);
      console.log(result.rows.map(r => r.column_name).join(', '));
    }
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

getColumns();
