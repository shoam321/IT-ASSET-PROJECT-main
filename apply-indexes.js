import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from Agent folder
dotenv.config({ path: path.join(__dirname, 'itam-saas', 'Agent', '.env') });

const { Pool } = pg;

async function applyIndexes() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('📊 Connecting to database...');
    const client = await pool.connect();
    
    console.log('📝 Reading SQL file...');
    const sql = fs.readFileSync(
      path.join(__dirname, 'itam-saas', 'Agent', 'migrations', 'add-performance-indexes.sql'),
      'utf8'
    );
    
    console.log('🚀 Creating indexes...');
    await client.query(sql);
    
    console.log('✅ Performance indexes created successfully!');
    
    // Show index stats
    const stats = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    
    console.log(`\n📈 Total indexes: ${stats.rows.length}`);
    console.log('\nIndexes by table:');
    
    const byTable = {};
    stats.rows.forEach(row => {
      if (!byTable[row.tablename]) byTable[row.tablename] = [];
      byTable[row.tablename].push(row.indexname);
    });
    
    Object.entries(byTable).forEach(([table, indexes]) => {
      console.log(`  ${table}: ${indexes.length} indexes`);
    });
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Error applying indexes:', error.message);
    await pool.end();
    process.exit(1);
  }
}

applyIndexes();
