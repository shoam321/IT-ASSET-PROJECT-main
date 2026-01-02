// [2025-12-27] Google SSO Fix:
// Ensured the 'users' table exists in the Railway Postgres database with all required columns, including 'username'.
// This resolves errors where the backend could not insert or find users due to missing columns.
// Schema validated and updated using DBeaver with the correct Railway connection settings.

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Only load .env file in development - Railway sets env vars directly in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (process.env.NODE_ENV !== 'production') {
  const envLocalPath = path.join(__dirname, '.env.local');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
  } else if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  application_name: 'itam_tracker',
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Fail fast if can't connect in 10s
});

// AsyncLocalStorage context for binding a single pg Client to a single request.
// This is critical for Row-Level Security (RLS) based on session variables like:
//   set_config('app.current_user_id', '<id>', false)
// because pooled connections otherwise change between queries.
export const dbAsyncLocalStorage = new AsyncLocalStorage();

// Route all pool.query calls to the request-bound client when available.
const _poolQuery = pool.query.bind(pool);
pool.query = (...args) => {
  const store = dbAsyncLocalStorage.getStore();
  if (store?.client) {
    return store.client.query(...args);
  }
  return _poolQuery(...args);
};

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
