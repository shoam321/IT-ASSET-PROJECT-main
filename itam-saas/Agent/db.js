// [2025-12-27] Google SSO Fix:
// Ensured the 'users' table exists in the Railway Postgres database with all required columns, including 'username'.
// This resolves errors where the backend could not insert or find users due to missing columns.
// Schema validated and updated using DBeaver with the correct Railway connection settings.

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
