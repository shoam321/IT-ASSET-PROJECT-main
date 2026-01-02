import pool from './db.js';

async function createAuditLogsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(100),
        record_id INTEGER,
        action VARCHAR(50),
        old_data JSONB,
        new_data JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    `);
    console.log('✅ audit_logs table created');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

createAuditLogsTable();
