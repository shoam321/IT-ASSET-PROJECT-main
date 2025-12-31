#!/usr/bin/env node

/**
 * Apply fix-organizations-insert-rls.sql migration
 * Run with DATABASE_OWNER_URL (preferred) or DATABASE_URL set
 * For production Railway, use the postgres superuser credentials
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  const ownerDsn = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;
  if (!ownerDsn) {
    console.error('❌ DATABASE_URL or DATABASE_OWNER_URL not configured');
    process.exit(1);
  }

  const ownerPool = new Pool({
    connectionString: ownerDsn,
    ssl: ownerDsn.includes('railway') ? { rejectUnauthorized: false } : false
  });

  let client;
  try {
    client = await ownerPool.connect();
    
    const migrationPath = path.join(__dirname, 'migrations', 'fix-organizations-insert-rls.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Applying organizations INSERT RLS policy migration...');
    await client.query(sql);
    console.log('✅ Organizations INSERT RLS policies created successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) console.error('Details:', error.detail);
    process.exit(1);
  } finally {
    if (client) client.release();
    await ownerPool.end();
  }
}

runMigration();
