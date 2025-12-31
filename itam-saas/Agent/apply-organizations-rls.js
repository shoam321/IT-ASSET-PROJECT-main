#!/usr/bin/env node
/**
 * Apply RLS INSERT policy to organizations table
 * Uses owner database credentials to create RLS policies
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function applyFix() {
  const dbUrl = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL or DATABASE_OWNER_URL not configured');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('railway') ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  
  try {
    console.log('📋 Applying organizations RLS INSERT policy...\n');
    
    // Read and execute the migration
    const migrationPath = path.join(__dirname, 'fix-organizations-rls.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    const result = await client.query(sql);
    
    console.log('✅ RLS INSERT policy applied successfully');
    console.log('\n📊 Result:', result.command);
    console.log('\n🔐 Organizations table now allows inserts via withSystemContext()');
    console.log('💡 The app.system="1" flag must be set by withSystemContext() in queries.js');
    
  } catch (error) {
    console.error('❌ Failed to apply RLS policy:', error.message);
    if (error.code === '42501') {
      console.error('\n⚠️  Permission denied. Make sure:');
      console.error('   1. DATABASE_OWNER_URL points to a schema owner');
      console.error('   2. The database user has ALTER TABLE privileges');
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyFix().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
