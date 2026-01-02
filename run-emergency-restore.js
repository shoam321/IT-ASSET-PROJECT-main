// Emergency Database Restore Script
// Run with: node run-emergency-restore.js

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway';

async function runRestore() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Connecting to Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'EMERGENCY_DB_RESTORE.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolons but keep DO blocks together
    const statements = [];
    let currentStatement = '';
    let inDoBlock = false;
    
    for (const line of sql.split('\n')) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments at statement boundaries
      if (!currentStatement && (trimmed === '' || trimmed.startsWith('--'))) {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Track DO blocks
      if (trimmed.toUpperCase().startsWith('DO $$') || trimmed.toUpperCase().startsWith('DO $')) {
        inDoBlock = true;
      }
      if (inDoBlock && (trimmed.endsWith('$$;') || trimmed === '$$;')) {
        inDoBlock = false;
      }
      
      // Track CREATE FUNCTION blocks
      if (trimmed.toUpperCase().includes('CREATE OR REPLACE FUNCTION') || 
          trimmed.toUpperCase().includes('CREATE FUNCTION')) {
        inDoBlock = true;
      }
      if (inDoBlock && trimmed.includes('$$ LANGUAGE')) {
        inDoBlock = false;
      }
      
      // End of statement
      if (!inDoBlock && trimmed.endsWith(';')) {
        const stmt = currentStatement.trim();
        if (stmt && !stmt.startsWith('--')) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }

    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
      
      try {
        const result = await client.query(stmt);
        successCount++;
        
        // Show CREATE TABLE results
        if (stmt.toUpperCase().includes('CREATE TABLE')) {
          const match = stmt.match(/CREATE TABLE IF NOT EXISTS\s+"?(\w+)"?/i);
          if (match) {
            console.log(`✅ Table: ${match[1]}`);
          }
        }
        // Show SELECT results
        else if (stmt.toUpperCase().startsWith('SELECT') && result.rows.length > 0) {
          console.log('\n📊 Query Result:');
          console.table(result.rows);
        }
      } catch (err) {
        errorCount++;
        // Only show errors for non-duplicate issues
        if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
          console.error(`❌ Error at statement ${i + 1}: ${err.message}`);
          console.error(`   Statement: ${preview}...`);
        }
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`${'='.repeat(50)}\n`);

    // Verify tables exist
    console.log('🔍 Verifying critical tables...\n');
    const tables = ['auth_users', 'organizations', 'assets', 'licenses', 'users', 'contracts', 'devices', 'device_usage'];
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`✅ ${table}: ${result.rows[0].count} rows`);
      } catch (err) {
        console.error(`❌ ${table}: MISSING or ERROR - ${err.message}`);
      }
    }

    console.log('\n🎉 Database restore complete!');

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runRestore();
