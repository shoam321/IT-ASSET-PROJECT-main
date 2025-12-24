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
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
