// One-off helper to create grafana_reader role with read-only grants
import pkg from 'pg';
const { Client } = pkg;

const connectionString = process.env.DATABASE_URL;
const password = process.env.GRAFANA_READER_PASSWORD || 'GrafanaR3adOnly!2025';

const statements = [
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_reader') THEN
       CREATE ROLE grafana_reader WITH LOGIN PASSWORD '${password}';
     END IF;
   END
  $$;`,
  'GRANT CONNECT ON DATABASE railway TO grafana_reader;',
  'GRANT USAGE ON SCHEMA public TO grafana_reader;',
  'GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;',
  'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_reader;'
];

async function main() {
  if (!connectionString) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    for (const s of statements) {
      console.log('Running:', s.split('\n')[0].slice(0, 80), '...');
      await client.query(s);
    }
    console.log('✅ grafana_reader ready. Password:', password);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
