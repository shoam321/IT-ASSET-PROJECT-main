import pool from './db.js';

const q = `
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'assets'
  ORDER BY ordinal_position;
`;

try {
  const result = await pool.query(q);
  console.log(result.rows);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
