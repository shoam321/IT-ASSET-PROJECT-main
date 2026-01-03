import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
let schemaCache = null;

/**
 * MANDATORY: Get actual database schema before ANY query
 * DO NOT write SQL without calling this first
 */
export async function getSchema() {
  if (schemaCache) return schemaCache;
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const result = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    
    const schema = {};
    result.rows.forEach(row => {
      if (!schema[row.table_name]) {
        schema[row.table_name] = {};
      }
      schema[row.table_name][row.column_name] = row.data_type;
    });
    
    schemaCache = schema;
    await pool.end();
    return schema;
  } catch (error) {
    await pool.end();
    throw error;
  }
}

/**
 * MANDATORY: Validate query before execution
 * Will throw error if table or column doesn't exist
 */
export async function validateQuery(tableName, columns = []) {
  const schema = await getSchema();
  
  if (!schema[tableName]) {
    throw new Error(`❌ TABLE "${tableName}" DOES NOT EXIST. Available tables: ${Object.keys(schema).join(', ')}`);
  }
  
  const tableColumns = Object.keys(schema[tableName]);
  
  for (const col of columns) {
    if (!schema[tableName][col]) {
      throw new Error(`❌ COLUMN "${col}" DOES NOT EXIST in table "${tableName}". Available columns: ${tableColumns.join(', ')}`);
    }
  }
  
  return true;
}

/**
 * Get columns for a specific table
 */
export async function getTableColumns(tableName) {
  const schema = await getSchema();
  if (!schema[tableName]) {
    throw new Error(`Table "${tableName}" does not exist`);
  }
  return Object.keys(schema[tableName]);
}

/**
 * Check if column exists
 */
export async function columnExists(tableName, columnName) {
  const schema = await getSchema();
  return schema[tableName] && schema[tableName][columnName] !== undefined;
}

/**
 * Print schema for debugging
 */
export async function printSchema(tableName = null) {
  const schema = await getSchema();
  
  if (tableName) {
    if (!schema[tableName]) {
      console.log(`❌ Table "${tableName}" not found`);
      return;
    }
    console.log(`\n${tableName}:`);
    console.log(Object.keys(schema[tableName]).join(', '));
  } else {
    console.log('\n📊 Full Schema:\n');
    Object.entries(schema).forEach(([table, cols]) => {
      console.log(`${table}: ${Object.keys(cols).join(', ')}`);
    });
  }
}
