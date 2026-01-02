import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Export pool getter for health checks
export function getPool() {
  return pool;
}

// ============ RLS HELPERS ============

/**
 * Set the current user ID for PostgreSQL Row-Level Security (RLS)
 */
export async function setCurrentUserId(userId) {
  try {
    const shouldLogRls = String(process.env.DEBUG_RLS || '').toLowerCase() === 'true';

    if (userId === undefined || userId === null) {
      console.warn('⚠️ setCurrentUserId called with undefined/null userId, using 0');
      userId = 0;
    }

    await pool.query('SELECT set_config($1, $2, false)', ['app.current_user_id', userId.toString()]);

    if (shouldLogRls) {
      console.log(`🔐 RLS current_user_id set to ${userId}`);
    }
  } catch (error) {
    console.error('Error setting current user ID:', error);
    throw error;
  }
}

/**
 * Execute a query with RLS context properly set using a dedicated client from the pool.
 * This ensures the session variable and queries execute on the same connection.
 */
export async function withRLSContext(userId, callback) {
  const client = await pool.connect();
  try {
    const shouldLogRls = String(process.env.DEBUG_RLS || '').toLowerCase() === 'true';
    if (shouldLogRls) {
      console.log(`🔐 Setting app.current_user_id = ${userId}`);
    }

    await client.query("SELECT set_config('app.current_user_id', $1, false)", [userId.toString()]);

    if (shouldLogRls) {
      const verify = await client.query("SELECT current_setting('app.current_user_id', true) as value");
      console.log(`✅ Verified app.current_user_id = ${verify.rows[0].value}`);
    }

    return await callback(client);
  } finally {
    client.release();
  }
}

/**
 * Execute a query with system context (owner/unrestricted).
 * Uses DATABASE_OWNER_URL if available, otherwise DATABASE_URL.
 * Sets app.system = '1' to allow system-level RLS policies.
 */
export async function withSystemContext(callback) {
  const { Pool } = await import('pg');
  const ownerDsn = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;
  if (!ownerDsn) throw new Error('DATABASE_URL not configured');

  const systemPool = new Pool({
    connectionString: ownerDsn,
    ssl: ownerDsn.includes('railway') ? { rejectUnauthorized: false } : false
  });
  const client = await systemPool.connect();
  try {
    // Set system context flag for RLS policies
    await client.query("SELECT set_config('app.system', '1', false)");
    return await callback(client);
  } finally {
    client.release();
    await systemPool.end();
  }
}

/** Lightweight DB/session diagnostics */
export async function getDbSessionInfo() {
  try {
    const r = await pool.query(
      "SELECT current_database() AS database, current_user AS \"user\", current_setting('search_path', true) AS search_path"
    );
    return r.rows[0] || null;
  } catch {
    return null;
  }
}

/** Presence checks for consumables tables */
export async function getConsumablesSchemaDiagnostics() {
  try {
    const r = await pool.query(
      "SELECT to_regclass('public.consumables') AS consumables, to_regclass('public.consumable_transactions') AS consumable_transactions"
    );
    return r.rows[0] || null;
  } catch {
    return null;
  }
}

// ============ GRAFANA DASHBOARD HELPERS ============

export async function listGrafanaDashboards(organizationId, client = pool) {
  const result = await client.query(
    'SELECT id, name, description, embed_url, created_by, created_at, updated_at FROM grafana_dashboards WHERE organization_id = $1 ORDER BY created_at DESC',
    [organizationId]
  );
  return result.rows;
}

export async function createGrafanaDashboard(organizationId, { name, description, embedUrl, createdBy }, client = pool) {
  const result = await client.query(
    `INSERT INTO grafana_dashboards (organization_id, name, description, embed_url, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (organization_id, name)
       DO UPDATE SET description = EXCLUDED.description, embed_url = EXCLUDED.embed_url, updated_at = CURRENT_TIMESTAMP
     RETURNING id, name, description, embed_url, created_by, created_at, updated_at`,
    [organizationId, name, description || null, embedUrl, createdBy || null]
  );
  return result.rows[0];
}

export async function updateGrafanaDashboard(organizationId, dashboardId, { name, description, embedUrl }, client = pool) {
  const result = await client.query(
    `UPDATE grafana_dashboards
        SET name = COALESCE($3, name),
            description = COALESCE($4, description),
            embed_url = COALESCE($5, embed_url),
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND organization_id = $2
      RETURNING id, name, description, embed_url, created_by, created_at, updated_at`,
    [dashboardId, organizationId, name || null, description || null, embedUrl || null]
  );
  return result.rows[0] || null;
}

export async function deleteGrafanaDashboard(organizationId, dashboardId, client = pool) {
  const result = await client.query(
    'DELETE FROM grafana_dashboards WHERE id = $1 AND organization_id = $2 RETURNING id',
    [dashboardId, organizationId]
  );
  return result.rowCount > 0;
}

/**
 * Verify database tables exist (no automatic creation)
 */
export async function initDatabase() {
  try {
    console.log('🔄 Verifying database tables...');

    // Verify tables exist
    const tablesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'assets'
      ) as assets_exists,
      EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'licenses'
      ) as licenses_exists,
      EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'users'
      ) as users_exists,
      EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts'
      ) as contracts_exists,
      EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'forbidden_apps'
      ) as forbidden_apps_exists,
      EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'security_alerts'
      ) as security_alerts_exists,
      EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'consumables'
      ) as consumables_exists,
      EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'consumable_transactions'
      ) as consumable_transactions_exists;
    `);
    
    const { assets_exists, licenses_exists, users_exists, contracts_exists, forbidden_apps_exists, security_alerts_exists, consumables_exists, consumable_transactions_exists } = tablesCheck.rows[0];
    
    if (assets_exists) {
      console.log('✅ Assets table exists');
    } else {
      console.warn('⚠️ Assets table not found');
    }
    
    if (licenses_exists) {
      console.log('✅ Licenses table exists');
    } else {
      console.warn('⚠️ Licenses table not found');
    }
    
    if (users_exists) {
      console.log('✅ Users table exists');
    } else {
      console.warn('⚠️ Users table not found');
    }
    
    if (contracts_exists) {
      console.log('✅ Contracts table exists');
    } else {
      console.warn('⚠️ Contracts table not found');
    }
    
    if (forbidden_apps_exists) {
      console.log('✅ Forbidden Apps table exists');
    } else {
      console.warn('⚠️ Forbidden Apps table not found - run: node run-forbidden-migration.js');
    }
    
    if (security_alerts_exists) {
      console.log('✅ Security Alerts table exists');
    } else {
      console.warn('⚠️ Security Alerts table not found - run: node run-forbidden-migration.js');
    }
    
    if (consumables_exists && consumable_transactions_exists) {
      console.log('✅ Consumables tables exist');
    } else {
      console.warn('⚠️ Consumables tables not found');
      const autoMigrate = String(process.env.AUTO_MIGRATE_CONSUMABLES || '').toLowerCase();
      if (autoMigrate === 'true' || autoMigrate === '1' || (process.env.NODE_ENV !== 'production' && autoMigrate !== 'false')) {
        try {
          const migrationPath = path.join(__dirname, 'migrations', 'add-consumables.sql');
          const sql = fs.readFileSync(migrationPath, 'utf8');
          console.log('🔄 Applying consumables migration automatically...');
          await pool.query(sql);
          console.log('✅ Consumables migration applied successfully');
        } catch (mErr) {
          console.error('❌ Failed to apply consumables migration automatically:', mErr.message);
          console.warn('ℹ️ You can run it manually: node itam-saas/Agent/migrations/run-consumables-migration.js');
        }
      } else {
        console.warn('ℹ️ AUTO_MIGRATE_CONSUMABLES is disabled. To create tables, run: node itam-saas/Agent/migrations/run-consumables-migration.js');
      }
    }
    
    if (assets_exists && licenses_exists && users_exists && contracts_exists) {
      console.log('✅ All required database tables verified successfully');
    } else {
      throw new Error(`Missing tables: assets=${assets_exists}, licenses=${licenses_exists}, users=${users_exists}, contracts=${contracts_exists}`);
    }
  } catch (error) {
    console.error('❌ Error verifying database:', error);
    throw error;
  }
}

/**
 * Get all assets
 * @param {number} organizationId - Organization ID for multi-tenant filtering (REQUIRED for security)
 */
export async function getAllAssets(organizationId = null) {
  try {
    // SECURITY: Require organizationId for multi-tenant isolation
    if (!organizationId) {
      console.warn('[SECURITY] getAllAssets called without organizationId - returning empty array');
      return [];
    }
    
    if (await assetsHasOrganizationIdColumn()) {
      const result = await pool.query(
        'SELECT * FROM assets WHERE organization_id = $1 ORDER BY created_at DESC',
        [organizationId]
      );
      return result.rows;
    }

    // Legacy schema fallback - still requires org check but column doesn't exist
    // Return empty to prevent cross-tenant data leakage
    console.warn('[SECURITY] Assets table missing organization_id column - returning empty for safety');
    return [];
  } catch (error) {
    console.error('Error fetching assets:', error);
    throw error;
  }
}

let _assetsHasUserIdColumn;
async function assetsHasUserIdColumn() {
  if (typeof _assetsHasUserIdColumn === 'boolean') return _assetsHasUserIdColumn;
  try {
    const result = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'assets'
         AND column_name = 'user_id'
       LIMIT 1`
    );
    _assetsHasUserIdColumn = result.rowCount > 0;
    return _assetsHasUserIdColumn;
  } catch (e) {
    // Fail open to legacy schema behavior if information_schema isn't accessible.
    _assetsHasUserIdColumn = false;
    return _assetsHasUserIdColumn;
  }
}

// Clear cached column checks (call after schema changes)
export function clearColumnCache() {
  _assetsHasOrganizationIdColumn = undefined;
  _assetsHasUserIdColumn = undefined;
  _assetsHasCategoryColumn = undefined;
  console.log('🔄 Column cache cleared - will re-check on next query');
}

let _assetsHasOrganizationIdColumn;
async function assetsHasOrganizationIdColumn() {
  if (typeof _assetsHasOrganizationIdColumn === 'boolean') return _assetsHasOrganizationIdColumn;
  try {
    const result = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'assets'
         AND column_name = 'organization_id'
       LIMIT 1`
    );
    _assetsHasOrganizationIdColumn = result.rowCount > 0;
    console.log(`📊 assetsHasOrganizationIdColumn check: ${_assetsHasOrganizationIdColumn}`);
    return _assetsHasOrganizationIdColumn;
  } catch (e) {
    console.error('❌ Error checking organization_id column:', e.message);
    _assetsHasOrganizationIdColumn = false;
    return _assetsHasOrganizationIdColumn;
  }
}

let _assetsHasCategoryColumn;
async function assetsHasCategoryColumn() {
  if (typeof _assetsHasCategoryColumn === 'boolean') return _assetsHasCategoryColumn;
  try {
    const result = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'assets'
         AND column_name = 'category'
       LIMIT 1`
    );
    _assetsHasCategoryColumn = result.rowCount > 0;
    return _assetsHasCategoryColumn;
  } catch (e) {
    _assetsHasCategoryColumn = false;
    return _assetsHasCategoryColumn;
  }
}

async function getUserIdentityById(userId) {
  const result = await pool.query(
    'SELECT username, full_name, email FROM auth_users WHERE id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

function normalizeIdentityValues(identity) {
  const values = [];
  if (!identity) return values;
  for (const v of [identity.username, identity.full_name, identity.email]) {
    if (typeof v === 'string' && v.trim()) values.push(v.trim());
  }
  // De-dup case-insensitively
  const seen = new Set();
  return values.filter(v => {
    const k = v.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Get assets for a specific user (defense-in-depth alongside RLS)
 */
export async function getAssetsForUser(userId, organizationId = null) {
  try {
    if (await assetsHasUserIdColumn()) {
      if (await assetsHasOrganizationIdColumn()) {
        const result = await pool.query(
          'SELECT * FROM assets WHERE user_id = $1 AND organization_id = $2 ORDER BY created_at DESC',
          [userId, organizationId]
        );
        return result.rows;
      }
      const result = await pool.query(
        'SELECT * FROM assets WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return result.rows;
    }

    // Legacy schema fallback: assets has assigned_user_name but no user_id.
    const identity = await getUserIdentityById(userId);
    const values = normalizeIdentityValues(identity);
    if (values.length === 0) return [];

    const params = [values.map(v => v.toLowerCase())];
    let sql = `SELECT *
       FROM assets
       WHERE lower(assigned_user_name) = ANY ($1)`;
    if (await assetsHasOrganizationIdColumn()) {
      sql += ' AND organization_id = $2';
      params.push(organizationId);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching assets for user:', error);
    throw error;
  }
}

/**
 * Get asset by ID
 */
export async function getAssetById(id, organizationId = null) {
  try {
    if (await assetsHasOrganizationIdColumn()) {
      const result = await pool.query('SELECT * FROM assets WHERE id = $1 AND organization_id = $2', [id, organizationId]);
      return result.rows[0];
    }
    const result = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching asset:', error);
    throw error;
  }
}

/**
 * Get asset by ID scoped to a user
 */
export async function getAssetByIdForUser(id, userId, organizationId = null) {
  try {
    if (await assetsHasUserIdColumn()) {
      if (await assetsHasOrganizationIdColumn()) {
        const result = await pool.query(
          'SELECT * FROM assets WHERE id = $1 AND user_id = $2 AND organization_id = $3',
          [id, userId, organizationId]
        );
        return result.rows[0];
      }
      const result = await pool.query(
        'SELECT * FROM assets WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      return result.rows[0];
    }

    const identity = await getUserIdentityById(userId);
    const values = normalizeIdentityValues(identity);
    if (values.length === 0) return null;

    const params = [id, values.map(v => v.toLowerCase())];
    let sql = `SELECT *
       FROM assets
       WHERE id = $1
         AND lower(assigned_user_name) = ANY ($2)`;
    if (await assetsHasOrganizationIdColumn()) {
      sql += ' AND organization_id = $3';
      params.push(organizationId);
    }
    const result = await pool.query(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching asset for user:', error);
    throw error;
  }
}

/**
 * Get asset by tag
 */
export async function getAssetByTag(assetTag) {
  try {
    const result = await pool.query('SELECT * FROM assets WHERE asset_tag = $1', [assetTag]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching asset by tag:', error);
    throw error;
  }
}

/**
 * Create new asset
 */
export async function createAsset(assetData) {
  const { asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status, cost, discovered, user_id, category, organization_id } = assetData;
  
  try {
    // Check if category column exists
    const hasCategoryColumn = await assetsHasCategoryColumn();
    
    if (await assetsHasUserIdColumn()) {
      const hasOrg = await assetsHasOrganizationIdColumn();
      if (hasCategoryColumn) {
        const result = await pool.query(
          `INSERT INTO assets (asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status, cost, discovered, user_id, category${hasOrg ? ', organization_id' : ''})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11${hasOrg ? ', $12' : ''})
           RETURNING *`,
          hasOrg
            ? [asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status || 'In Use', cost || 0, discovered || false, user_id, category, organization_id]
            : [asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status || 'In Use', cost || 0, discovered || false, user_id, category]
        );
        return result.rows[0];
      } else {
        const result = await pool.query(
          `INSERT INTO assets (asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status, cost, discovered, user_id${hasOrg ? ', organization_id' : ''})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10${hasOrg ? ', $11' : ''})
           RETURNING *`,
          hasOrg
            ? [asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status || 'In Use', cost || 0, discovered || false, user_id, organization_id]
            : [asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status || 'In Use', cost || 0, discovered || false, user_id]
        );
        return result.rows[0];
      }
    }

    // Legacy schema fallback: store ownership in assigned_user_name.
    let assignedName = assigned_user_name;
    if ((!assignedName || !String(assignedName).trim()) && user_id) {
      const identity = await getUserIdentityById(user_id);
      assignedName = identity?.username || identity?.full_name || identity?.email || null;
    }

    if (hasCategoryColumn) {
      const result = await pool.query(
        `INSERT INTO assets (asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status, cost, discovered, category${await assetsHasOrganizationIdColumn() ? ', organization_id' : ''})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10${await assetsHasOrganizationIdColumn() ? ', $11' : ''})
         RETURNING *`,
        await assetsHasOrganizationIdColumn()
          ? [asset_tag, asset_type, manufacturer, model, serial_number, assignedName, status || 'In Use', cost || 0, discovered || false, category, organization_id]
          : [asset_tag, asset_type, manufacturer, model, serial_number, assignedName, status || 'In Use', cost || 0, discovered || false, category]
      );
      return result.rows[0];
    } else {
      const result = await pool.query(
        `INSERT INTO assets (asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status, cost, discovered${await assetsHasOrganizationIdColumn() ? ', organization_id' : ''})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9${await assetsHasOrganizationIdColumn() ? ', $10' : ''})
         RETURNING *`,
        await assetsHasOrganizationIdColumn()
          ? [asset_tag, asset_type, manufacturer, model, serial_number, assignedName, status || 'In Use', cost || 0, discovered || false, organization_id]
          : [asset_tag, asset_type, manufacturer, model, serial_number, assignedName, status || 'In Use', cost || 0, discovered || false]
      );
      return result.rows[0];
    }
  } catch (error) {
    console.error('Error creating asset:', error);
    console.error('Error details:', error.message, error.code, error.detail);
    throw new Error(`Failed to create asset: ${error.message}`);
  }
}

/**
 * Update asset
 */
export async function updateAsset(id, assetData, organizationId = null) {
  // Legacy schema compatibility: translate user_id updates into assigned_user_name.
  if (!(await assetsHasUserIdColumn()) && assetData && Object.prototype.hasOwnProperty.call(assetData, 'user_id')) {
    const newUserId = assetData.user_id;
    delete assetData.user_id;
    if (newUserId) {
      const identity = await getUserIdentityById(newUserId);
      const assignedName = identity?.username || identity?.full_name || identity?.email || null;
      if (assignedName) {
        assetData.assigned_user_name = assignedName;
      }
    }
  }

  const fields = [];
  const values = [];
  let paramCount = 1;
  const hasOrganizationId = await assetsHasOrganizationIdColumn();

  for (const [key, value] of Object.entries(assetData)) {
    if (key === 'organization_id' && !hasOrganizationId) {
      continue;
    }
    if (value !== undefined && value !== null) {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  fields.push(`updated_at = $${paramCount}`);
  values.push(new Date());
  values.push(id);
  let whereClause = `WHERE id = $${paramCount + 1}`;
  if (hasOrganizationId) {
    values.push(organizationId);
    whereClause += ` AND organization_id = $${paramCount + 2}`;
  }

  try {
    const query = `UPDATE assets SET ${fields.join(', ')} ${whereClause} RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating asset:', error);
    throw error;
  }
}

/**
 * Delete asset
 */
export async function deleteAsset(id, organizationId = null) {
  try {
    const params = [id];
    let sql = 'DELETE FROM assets WHERE id = $1';
    if (await assetsHasOrganizationIdColumn()) {
      params.push(organizationId);
      sql += ' AND organization_id = $2';
    }
    sql += ' RETURNING *';
    const result = await pool.query(sql, params);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting asset:', error);
    throw error;
  }
}

/**
 * Search assets
 */
export async function searchAssets(query, organizationId = null) {
  try {
    const searchTerm = `%${query}%`;
    const hasCategoryColumn = await assetsHasCategoryColumn();
    const hasOrganizationId = await assetsHasOrganizationIdColumn();

    const params = [searchTerm];
    let sql = `SELECT * FROM assets
      WHERE (
        asset_tag ILIKE $1
        OR manufacturer ILIKE $1
        OR model ILIKE $1
        OR assigned_user_name ILIKE $1`;

    if (hasCategoryColumn) {
      sql += '\n        OR category ILIKE $1';
    }

    sql += '\n      )';

    if (hasOrganizationId) {
      sql += ' AND organization_id = $2';
      params.push(organizationId);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Error searching assets:', error);
    throw error;
  }
}

/**
 * Search assets scoped to a user
 */
export async function searchAssetsForUser(query, userId, organizationId = null) {
  try {
    const searchTerm = `%${query}%`;
    const hasOrganizationId = await assetsHasOrganizationIdColumn();

    if (await assetsHasUserIdColumn()) {
      const params = [searchTerm, userId];
      let sql =
        `SELECT * FROM assets
         WHERE user_id = $2
           AND (
             asset_tag ILIKE $1
             OR manufacturer ILIKE $1
             OR model ILIKE $1
             OR assigned_user_name ILIKE $1
           )`;
      if (hasOrganizationId) {
        sql += ' AND organization_id = $3';
        params.push(organizationId);
      }
      sql += ' ORDER BY created_at DESC';
      const result = await pool.query(sql, params);
      return result.rows;
    }

    const identity = await getUserIdentityById(userId);
    const values = normalizeIdentityValues(identity);
    if (values.length === 0) return [];

    const params = [searchTerm, values.map(v => v.toLowerCase())];
    let sql =
      `SELECT *
       FROM assets
       WHERE lower(assigned_user_name) = ANY ($2)
         AND (
           asset_tag ILIKE $1
           OR manufacturer ILIKE $1
           OR model ILIKE $1
           OR assigned_user_name ILIKE $1
         )`;
    if (hasOrganizationId) {
      sql += ' AND organization_id = $3';
      params.push(organizationId);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await pool.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('Error searching assets for user:', error);
    throw error;
  }
}

/**
 * Get asset statistics
 */
export async function getAssetStats() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_assets,
        COUNT(CASE WHEN status = 'In Use' THEN 1 END) as in_use,
        COUNT(CASE WHEN discovered = true THEN 1 END) as discovered,
        COUNT(CASE WHEN status = 'Retired' THEN 1 END) as retired
      FROM assets
    `);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
}

// ============ LICENSES FUNCTIONS ============

/**
 * Get all licenses
 */
export async function getAllLicenses() {
  try {
    const result = await pool.query('SELECT * FROM licenses ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Error fetching licenses:', error);
    throw error;
  }
}

/**
 * Create license
 */
export async function createLicense(licenseData) {
  const { license_name, license_type, license_key, software_name, vendor, expiration_date, quantity, status, cost, notes } = licenseData;
  
  // Validate required fields
  if (!license_name || !license_name.trim()) {
    throw new Error('License name is required');
  }
  if (!license_type || !license_type.trim()) {
    throw new Error('License type is required');
  }
  
  // Format date to yyyy-MM-dd if provided
  let formattedDate = null;
  if (expiration_date) {
    if (typeof expiration_date === 'string') {
      if (expiration_date.includes('T')) {
        // ISO format - extract date part
        formattedDate = expiration_date.split('T')[0];
      } else if (expiration_date.includes('/')) {
        // dd/mm/yyyy format
        const parts = expiration_date.split('/');
        if (parts.length === 3) {
          formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      } else {
        // Assume already in correct format
        formattedDate = expiration_date;
      }
    }
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO licenses (license_name, license_type, license_key, software_name, vendor, expiration_date, quantity, status, cost, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        license_name.trim(), 
        license_type.trim(), 
        license_key?.trim() || null, 
        software_name?.trim() || null, 
        vendor?.trim() || null, 
        formattedDate, 
        quantity || 1, 
        status || 'Active', 
        cost || 0, 
        notes?.trim() || null
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating license:', error);
    console.error('Error details:', error.message, error.code, error.detail);
    throw new Error(`Failed to create license: ${error.message}`);
  }
}

/**
 * Update license
 */
export async function updateLicense(id, licenseData) {
  const fields = [];
  const values = [];
  let paramCount = 1;
  
  // Fields that should not be updated
  const excludeFields = ['id', 'created_at', 'updated_at'];

  for (const [key, value] of Object.entries(licenseData)) {
    // Skip excluded fields and undefined values
    if (excludeFields.includes(key) || value === undefined) {
      continue;
    }
    
    // Allow null values to be set
    let processedValue = value;
    
    if (value !== null) {
      // Format date fields
      if (key === 'expiration_date' && typeof value === 'string') {
        if (value.includes('T')) {
          processedValue = value.split('T')[0];
        } else if (value.includes('/')) {
          const parts = value.split('/');
          if (parts.length === 3) {
            processedValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
      }
      
      // Trim string values
      if (typeof processedValue === 'string') {
        processedValue = processedValue.trim();
      }
    }
    
    fields.push(`${key} = $${paramCount}`);
    values.push(processedValue);
    paramCount++;
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  fields.push(`updated_at = $${paramCount}`);
  values.push(new Date());
  values.push(id);

  try {
    const query = `UPDATE licenses SET ${fields.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`;
    console.log('Update query:', query);
    console.log('Update values:', values);
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating license:', error);
    throw error;
  }
}

/**
 * Delete license
 */
export async function deleteLicense(id) {
  try {
    const result = await pool.query('DELETE FROM licenses WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting license:', error);
    throw error;
  }
}

/**
 * Get license by ID (for audit logging)
 */
export async function getLicenseById(id) {
  try {
    const result = await pool.query('SELECT * FROM licenses WHERE id = $1', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching license by ID:', error);
    throw error;
  }
}

/**
 * Search licenses
 */
export async function searchLicenses(query) {
  try {
    const searchTerm = `%${query}%`;
    const result = await pool.query(
      `SELECT * FROM licenses 
       WHERE license_name ILIKE $1 
          OR software_name ILIKE $1 
          OR vendor ILIKE $1 
          OR license_key ILIKE $1
       ORDER BY created_at DESC`,
      [searchTerm]
    );
    return result.rows;
  } catch (error) {
    console.error('Error searching licenses:', error);
    throw error;
  }
}

// ============ USERS FUNCTIONS ============

/**
 * Get all users
 */
export async function getAllUsers() {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

/**
 * Create user
 */
export async function createUser(userData) {
  const { username, email, department, phone, role, status, notes } = userData;
  try {
    const result = await pool.query(
      `INSERT INTO users (username, email, department, phone, role, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [username, email, department, phone, role, status || 'Active', notes]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating user:', error);
    console.error('Error details:', error.message, error.code, error.detail);
    throw new Error(`Failed to create user: ${error.message}`);
  }
}

/**
 * Update user
 */
export async function updateUser(id, userData) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  for (const [key, value] of Object.entries(userData)) {
    if (value !== undefined && value !== null) {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  fields.push(`updated_at = $${paramCount}`);
  values.push(new Date());
  values.push(id);

  try {
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

/**
 * Delete user
 */
export async function deleteUser(id) {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * Get user by ID (for audit logging)
 */
export async function getUserById(id) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    throw error;
  }
}

/**
 * Search users
 */
export async function searchUsers(query) {
  try {
    const searchTerm = `%${query}%`;
    const result = await pool.query(
      `SELECT * FROM users 
      WHERE username ILIKE $1
          OR email ILIKE $1 
          OR department ILIKE $1 
          OR phone ILIKE $1
       ORDER BY created_at DESC`,
      [searchTerm]
    );
    return result.rows;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
}

// ============ CONTRACTS FUNCTIONS ============

/**
 * Get all contracts
 */
export async function getAllContracts() {
  try {
    const result = await pool.query('SELECT * FROM contracts ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Error fetching contracts:', error);
    throw error;
  }
}

/**
 * Create contract
 */
export async function createContract(contractData) {
  const { contract_name, vendor, contract_type, start_date, end_date, value, status, notes } = contractData;
  try {
    const result = await pool.query(
      `INSERT INTO contracts (contract_name, vendor, contract_type, start_date, end_date, value, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [contract_name, vendor, contract_type, start_date || null, end_date || null, value || 0, status || 'Active', notes || null]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating contract:', error);
    console.error('Error details:', error.message, error.code, error.detail);
    throw new Error(`Failed to create contract: ${error.message}`);
  }
}

/**
 * Update contract
 */
export async function updateContract(id, contractData) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  // Exclude system fields that shouldn't be manually updated
  const excludeFields = ['id', 'created_at', 'updated_at'];

  for (const [key, value] of Object.entries(contractData)) {
    if (value !== undefined && value !== null && !excludeFields.includes(key)) {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  // Always update the updated_at timestamp
  fields.push(`updated_at = $${paramCount}`);
  values.push(new Date());
  values.push(id);

  try {
    const query = `UPDATE contracts SET ${fields.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating contract:', error);
    throw error;
  }
}

/**
 * Delete contract
 */
export async function deleteContract(id) {
  try {
    const result = await pool.query('DELETE FROM contracts WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting contract:', error);
    throw error;
  }
}

/**
 * Get contract by ID (for audit logging)
 */
export async function getContractById(id) {
  try {
    const result = await pool.query('SELECT * FROM contracts WHERE id = $1', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching contract by ID:', error);
    throw error;
  }
}

/**
 * Search contracts
 */
export async function searchContracts(query) {
  try {
    const searchTerm = `%${query}%`;
    const result = await pool.query(
      `SELECT * FROM contracts 
       WHERE contract_name ILIKE $1 
          OR vendor ILIKE $1 
          OR contact_person ILIKE $1 
          OR contact_email ILIKE $1
       ORDER BY created_at DESC`,
      [searchTerm]
    );
    return result.rows;
  } catch (error) {
    console.error('Error searching contracts:', error);
    throw error;
  }
}

// ============ AGENT / DEVICE MONITORING FUNCTIONS ============

/**
 * Upsert device (insert or update)
 * @param {Object} deviceData - Device data to upsert
 * @param {Object} client - Optional: PostgreSQL client with RLS context already set
 */
export async function upsertDevice(deviceData, client = null) {
  const { device_id, hostname, os_name, os_version, user_id } = deviceData;
  
  try {
    const queryClient = client || pool;
    const result = await queryClient.query(
      `INSERT INTO devices (device_id, hostname, os_name, os_version, user_id, last_seen, status)
       VALUES (
         $1,
         $2,
         $3,
         $4,
         COALESCE($5, current_setting('app.current_user_id', true)::integer),
         CURRENT_TIMESTAMP,
         'Active'
       )
       ON CONFLICT (device_id) 
       DO UPDATE SET 
         hostname = COALESCE($2, devices.hostname),
         os_name = COALESCE($3, devices.os_name),
         os_version = COALESCE($4, devices.os_version),
         -- Claim ownership only when safe:
         -- - If the row is unowned (legacy/dev)
         -- - Or it's owned by an admin seed account (common after migrations)
         -- Otherwise, do not change ownership (prevents "stealing" devices).
         user_id = CASE
           WHEN devices.user_id IS NULL THEN COALESCE($5, current_setting('app.current_user_id', true)::integer)
           WHEN EXISTS (
             SELECT 1
             FROM auth_users owner
             WHERE owner.id = devices.user_id
               AND owner.role = 'admin'
           ) THEN COALESCE($5, current_setting('app.current_user_id', true)::integer)
           ELSE devices.user_id
         END,
         last_seen = CURRENT_TIMESTAMP,
         status = 'Active',
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [device_id, hostname, os_name, os_version, user_id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error upserting device:', error);
    throw new Error(`Failed to upsert device: ${error.message}`);
  }
}

/**
 * Insert usage data
 * @param {Object} usageData - Usage data to insert
 * @param {Object} client - Optional: PostgreSQL client with RLS context already set
 */
export async function insertUsageData(usageData, client = null) {
  const { device_id, app_name, window_title, duration, timestamp, user_id } = usageData;
  
  try {
    const queryClient = client || pool;
    const result = await queryClient.query(
      `INSERT INTO device_usage (device_id, app_name, window_title, duration, timestamp, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [device_id, app_name, window_title || '', duration || 0, timestamp || Date.now(), user_id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error inserting usage data:', error);
    throw new Error(`Failed to insert usage data: ${error.message}`);
  }
}

/**
 * Insert heartbeat
 */
export async function insertHeartbeat(heartbeatData) {
  const { device_id, timestamp } = heartbeatData;
  
  try {
    const result = await pool.query(
      `INSERT INTO device_heartbeats (device_id, timestamp)
       VALUES ($1, $2)
       RETURNING *`,
      [device_id, timestamp || Date.now()]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error inserting heartbeat:', error);
    throw new Error(`Failed to insert heartbeat: ${error.message}`);
  }
}

/**
 * Upsert installed apps for a device
 */
export async function upsertInstalledApps(device_id, apps) {
  try {
    const insertPromises = apps.map(app => {
      const { app_name, app_version, install_date } = app;
      return pool.query(
        `INSERT INTO installed_apps (device_id, app_name, app_version, install_date)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (device_id, app_name) 
         DO UPDATE SET 
           app_version = COALESCE($2, installed_apps.app_version),
           install_date = COALESCE($3, installed_apps.install_date),
           last_updated = CURRENT_TIMESTAMP
         RETURNING *`,
        [device_id, app_name, app_version || null, install_date || null]
      );
    });
    
    const results = await Promise.all(insertPromises);
    return results.map(r => r.rows[0]);
  } catch (error) {
    console.error('Error upserting installed apps:', error);
    throw new Error(`Failed to upsert installed apps: ${error.message}`);
  }
}

/**
 * Get all devices
 */
export async function getAllDevices() {
  try {
    const result = await pool.query(
      `SELECT 
        d.*,
        COUNT(DISTINCT du.app_name) as app_count,
        COUNT(du.id) as usage_records,
        MAX(du.timestamp) as last_activity
       FROM devices d
       LEFT JOIN device_usage du ON d.device_id = du.device_id
       GROUP BY d.id
       ORDER BY d.last_seen DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching devices:', error);
    throw error;
  }
}

/**
 * Get device usage statistics
 */
export async function getDeviceUsageStats(device_id, startDate, endDate) {
  try {
    let query = `
      SELECT 
        app_name,
        COUNT(*) as usage_count,
        SUM(duration) as total_duration,
        AVG(duration) as avg_duration,
        MAX(timestamp) as last_used
      FROM device_usage
      WHERE device_id = $1
    `;
    
    const params = [device_id];
    let paramCount = 2;
    
    if (startDate) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(new Date(startDate));
      paramCount++;
    }
    
    if (endDate) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(new Date(endDate));
    }
    
    query += `
      GROUP BY app_name
      ORDER BY total_duration DESC
    `;
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching device usage stats:', error);
    throw error;
  }
}

/**
 * Get app usage summary across all devices
 */
export async function getAppUsageSummary(startDate, endDate) {
  try {
    let query = `
      SELECT 
        app_name,
        COUNT(DISTINCT device_id) as device_count,
        COUNT(*) as total_usage_count,
        SUM(duration) as total_duration,
        AVG(duration) as avg_duration
      FROM device_usage
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (startDate) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(new Date(startDate));
      paramCount++;
    }
    
    if (endDate) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(new Date(endDate));
    }
    
    query += `
      GROUP BY app_name
      ORDER BY total_duration DESC
      LIMIT 50
    `;
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching app usage summary:', error);
    throw error;
  }
}

/**
 * Get installed apps for a device
 */
export async function getInstalledApps(device_id) {
  try {
    const result = await pool.query(
      `SELECT * FROM installed_apps 
       WHERE device_id = $1 
       ORDER BY app_name ASC`,
      [device_id]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching installed apps:', error);
    throw error;
  }
}

// ============ FORBIDDEN APPS & SECURITY ALERTS FUNCTIONS ============

/**
 * Get all forbidden apps
 */
export async function getAllForbiddenApps() {
  try {
    const result = await pool.query(
      `SELECT fa.id, fa.name as process_name, fa.description, fa.severity, fa.created_at, fa.updated_at, 
              au.full_name AS created_by_name
       FROM forbidden_apps fa
       LEFT JOIN auth_users au ON fa.user_id = au.id
       ORDER BY fa.created_at DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching forbidden apps:', error);
    throw error;
  }
}

/**
 * Get forbidden apps as simple array (for agent sync)
 */
export async function getForbiddenAppsList() {
  try {
    const result = await pool.query(
      `SELECT name as process_name, severity FROM forbidden_apps`
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching forbidden apps list:', error);
    throw error;
  }
}

/**
 * Get forbidden app by id
 */
export async function getForbiddenAppById(id) {
  try {
    const result = await pool.query(
      'SELECT * FROM forbidden_apps WHERE id = $1',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching forbidden app by id:', error);
    throw error;
  }
}

/**
 * Create forbidden app
 */
export async function createForbiddenApp(appData) {
  const { process_name, description, severity, created_by } = appData;
  
  if (!process_name || !process_name.trim()) {
    throw new Error('Process name is required');
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO forbidden_apps (name, description, severity, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *, name as process_name`,
      [process_name.trim().toLowerCase(), description || null, severity || 'Medium', created_by || null]
    );
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      throw new Error(`Process "${process_name}" is already in the forbidden list`);
    }
    console.error('Error creating forbidden app:', error);
    throw new Error(`Failed to create forbidden app: ${error.message}`);
  }
}

/**
 * Update forbidden app
 */
export async function updateForbiddenApp(id, appData) {
  const fields = [];
  const values = [];
  let paramCount = 1;
  
  const excludeFields = ['id', 'created_at', 'updated_at', 'created_by', 'user_id'];
  const columnMapping = { process_name: 'name' };

  for (const [key, value] of Object.entries(appData)) {
    if (excludeFields.includes(key) || value === undefined) {
      continue;
    }
    
    let processedValue = value;
    if (key === 'process_name' && typeof value === 'string') {
      processedValue = value.trim().toLowerCase();
    } else if (typeof processedValue === 'string') {
      processedValue = processedValue.trim();
    }
    
    const columnName = columnMapping[key] || key;
    fields.push(`${columnName} = $${paramCount}`);
    values.push(processedValue);
    paramCount++;
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id);

  try {
    const query = `UPDATE forbidden_apps SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *, name as process_name`;
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating forbidden app:', error);
    throw error;
  }
}

/**
 * Delete forbidden app
 */
export async function deleteForbiddenApp(id) {
  try {
    const result = await pool.query(
      'DELETE FROM forbidden_apps WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting forbidden app:', error);
    throw error;
  }
}

/**
 * Create security alert
 */
export async function createSecurityAlert(alertData) {
  const { device_id, app_detected, severity, user_id, organization_id, details } = alertData;
  
  if (!device_id || !app_detected) {
    throw new Error('device_id and app_detected are required');
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO security_alerts (device_id, app_name, severity, user_id, organization_id, details, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'New')
       RETURNING *, app_name as app_detected`,
      [device_id, app_detected, severity || 'Medium', user_id || null, organization_id || null, details || null]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating security alert:', error);
    throw new Error(`Failed to create security alert: ${error.message}`);
  }
}

/**
 * Get all security alerts
 */
export async function getAllSecurityAlerts(limit = 100, status = null) {
  try {
    let query = `SELECT * FROM recent_alerts`;
    const params = [];
    
    if (status) {
      query += ` WHERE status = $1`;
      params.push(status);
      query += ` LIMIT $2`;
      params.push(limit);
    } else {
      query += ` LIMIT $1`;
      params.push(limit);
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching security alerts:', error);
    throw error;
  }
}

/**
 * Get alert statistics
 */
export async function getAlertStatistics() {
  try {
    const result = await pool.query('SELECT * FROM alert_statistics');
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching alert statistics:', error);
    throw error;
  }
}

/**
 * Update alert status
 */
export async function updateAlertStatus(id, status, resolved_by = null, notes = null) {
  try {
    const result = await pool.query(
      `UPDATE security_alerts 
       SET status = $1, 
           resolved_by = $2, 
           resolved_at = CASE WHEN $1 = 'Resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
           notes = COALESCE($3, notes)
       WHERE id = $4
       RETURNING *`,
      [status, resolved_by, notes, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error updating alert status:', error);
    throw error;
  }
}

/**
 * Get alerts for specific device
 */
export async function getDeviceAlerts(device_id, limit = 50) {
  try {
    const result = await pool.query(
      `SELECT * FROM security_alerts 
       WHERE device_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [device_id, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching device alerts:', error);
    throw error;
  }
}

/**
 * Cleanup old alerts (older than specified hours)
 * Prevents database from growing too large and slowing down queries
 */
export async function cleanupOldAlerts(hoursOld = 5) {
  try {
    const result = await pool.query(
      `DELETE FROM security_alerts 
       WHERE created_at < NOW() - ($1 * INTERVAL '1 hour')
       RETURNING id`,
      [hoursOld]
    );
    const deletedCount = result.rowCount;
    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} alerts older than ${hoursOld} hours`);
    }
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old alerts:', error);
    throw error;
  }
}

/**
 * ============================================================================
 * AUDIT TRAIL - Track all system changes for compliance and security
 * ============================================================================
 */

/**
 * Log an audit event (LOGIN, LOGOUT, CREATE, UPDATE, DELETE, EXPORT)
 * @param {string} tableName - Name of the table being modified
 * @param {number} recordId - ID of the record
 * @param {string} action - LOGIN, LOGOUT, CREATE, UPDATE, DELETE, or EXPORT
 * @param {object} oldData - Data before change (null for CREATE)
 * @param {object} newData - Data after change (null for DELETE)
 * @param {object} userInfo - {userId, username, ipAddress, userAgent}
 */
export async function logAuditEvent(tableName, recordId, action, oldData, newData, userInfo = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_logs 
       (table_name, record_id, action, old_data, new_data, user_id, username, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tableName,
        recordId,
        action,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        userInfo.userId || null,
        userInfo.username || null,
        userInfo.ipAddress || null,
        userInfo.userAgent || null
      ]
    );
  } catch (error) {
    // Don't throw - audit logging should never break the main operation
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Get audit logs with filters
 * @param {object} filters - {tableName, recordId, userId, startDate, endDate, action, limit, offset}
 */
export async function getAuditLogs(filters = {}) {
  try {
    let query = `
      SELECT
        al.*,
        au.full_name AS user_full_name,
        au.email AS user_email
      FROM audit_logs al
      LEFT JOIN auth_users au ON au.id = al.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.tableName) {
      query += ` AND al.table_name = $${paramCount}`;
      params.push(filters.tableName);
      paramCount++;
    }

    if (filters.recordId) {
      query += ` AND al.record_id = $${paramCount}`;
      params.push(filters.recordId);
      paramCount++;
    }

    if (filters.userId) {
      query += ` AND al.user_id = $${paramCount}`;
      params.push(filters.userId);
      paramCount++;
    }

    if (filters.action) {
      query += ` AND al.action = $${paramCount}`;
      params.push(filters.action);
      paramCount++;
    }

    if (filters.startDate) {
      query += ` AND al.created_at >= $${paramCount}`;
      params.push(filters.startDate);
      paramCount++;
    }

    if (filters.endDate) {
      query += ` AND al.created_at <= $${paramCount}`;
      params.push(filters.endDate);
      paramCount++;
    }

    query += ` ORDER BY al.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
      paramCount++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramCount}`;
      params.push(filters.offset);
      paramCount++;
    }

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
}

/**
 * Get audit history for a specific record
 */
export async function getRecordHistory(tableName, recordId) {
  try {
    const result = await pool.query(
      `SELECT
         al.*,
         au.full_name AS user_full_name,
         au.email AS user_email
       FROM audit_logs al
       LEFT JOIN auth_users au ON au.id = al.user_id
       WHERE al.table_name = $1 AND al.record_id = $2
       ORDER BY al.timestamp DESC`,
      [tableName, recordId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching record history:', error);
    throw error;
  }
}

/**
 * DIGITAL RECEIPTS FUNCTIONS
 */

/**
 * Upload a receipt for an asset
 */
export async function createReceipt(assetId, receiptData) {
  const client = await pool.connect();
  try {
    const { 
      file_name, file_path, file_size, file_type, description, 
      uploaded_by, uploaded_by_name, user_id,
      merchant, purchase_date, total_amount, tax_amount, currency,
      parsed_data, parsing_status
    } = receiptData;
    
    await client.query('BEGIN');
    
    // Set RLS context for the transaction
    await client.query(
      "SELECT set_config('app.current_user_id', $1, FALSE)",
      [user_id.toString()]
    );
    
    const result = await client.query(
      `INSERT INTO receipts (
        asset_id, file_name, file_path, file_size, file_type, description, 
        uploaded_by, uploaded_by_name, user_id,
        merchant, purchase_date, total_amount, tax_amount, currency,
        parsed_data, parsing_status
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        assetId, file_name, file_path, file_size, file_type, description || null, 
        uploaded_by, uploaded_by_name, user_id,
        merchant, purchase_date, total_amount, tax_amount, currency,
        parsed_data, parsing_status
      ]
    );
    
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating receipt:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all receipts for an asset
 */
export async function getReceiptsByAssetId(assetId) {
  try {
    const result = await pool.query(
      'SELECT * FROM receipts WHERE asset_id = $1 ORDER BY upload_date DESC',
      [assetId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching receipts:', error);
    throw error;
  }
}

/**
 * Get all receipts across all assets
 */
export async function getAllReceipts() {
  try {
    const result = await pool.query(
      'SELECT * FROM receipts ORDER BY upload_date DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching all receipts:', error);
    throw error;
  }
}

/**
 * Delete a receipt
 */
export async function deleteReceipt(id) {
  try {
    const result = await pool.query(
      'DELETE FROM receipts WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting receipt:', error);
    throw error;
  }
}

/**
 * Find or create user by Google profile
 */
export async function findOrCreateGoogleUser(profile) {
  try {
    const email = profile.emails[0].value;
    
    // Check auth_users by email (primary source of truth for authentication)
    let result = await pool.query(
      'SELECT * FROM auth_users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    // Create new user in auth_users
    // Handle username collision
    let username = profile.displayName || email.split('@')[0];
    const checkUsername = await pool.query('SELECT 1 FROM auth_users WHERE username = $1', [username]);
    if (checkUsername.rows.length > 0) {
        username = `${username}_${Math.floor(Math.random() * 10000)}`;
    }

    result = await pool.query(
      `INSERT INTO auth_users (username, email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        username,
        email,
        'GOOGLE_SSO_NO_PASSWORD', // Dummy hash, password login disabled for this user
        profile.displayName,
        'user',
        true
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Error finding/creating Google user:', error);
    throw error;
  }
}

// ============ ANALYTICS & DASHBOARD FUNCTIONS ============

/**
 * Get comprehensive dashboard analytics
 * @param {string} role - 'admin' or 'user'
 * @param {number} userId - User ID for filtering
 * @param {number} organizationId - Organization ID for multi-tenant filtering (REQUIRED)
 */
export async function getDashboardAnalytics(role = 'user', userId = null, organizationId = null) {
  try {
    // SECURITY: Always filter by organization_id for multi-tenant isolation
    if (!organizationId) {
      console.warn('[SECURITY] getDashboardAnalytics called without organizationId');
      return {
        overview: { total_assets: 0, total_users: 0, total_licenses: 0, total_contracts: 0, total_consumables: 0, low_stock_items: 0, active_contracts: 0, unresolved_alerts: 0 },
        assetsByCategory: [],
        assetsByStatus: [],
        recentActivity: [],
        upcomingExpirations: []
      };
    }

    // Check if tables have organization_id column
    const hasOrgCol = await assetsHasOrganizationIdColumn();
    const orgFilter = hasOrgCol ? 'WHERE organization_id = $1' : '';
    const orgParams = hasOrgCol ? [organizationId] : [];
    
    // Overview counts - filtered by organization
    const overviewQuery = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM assets ${orgFilter}) as total_assets,
        (SELECT COUNT(*) FROM auth_users WHERE is_active = true AND organization_id = $1) as total_users,
        (SELECT COUNT(*) FROM licenses) as total_licenses,
        (SELECT COUNT(*) FROM contracts) as total_contracts,
        (SELECT COUNT(*) FROM consumables) as total_consumables,
        (SELECT COUNT(*) FROM consumables WHERE quantity <= min_quantity) as low_stock_items
    `, [organizationId]);

    // Assets by category - filtered by organization
    const assetsByCategoryQuery = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM assets
      WHERE category IS NOT NULL AND category != '' ${hasOrgCol ? 'AND organization_id = $1' : ''}
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `, orgParams);

    // Assets by status - filtered by organization
    const assetsByStatusQuery = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM assets
      WHERE status IS NOT NULL AND status != '' ${hasOrgCol ? 'AND organization_id = $1' : ''}
      GROUP BY status
      ORDER BY count DESC
    `, orgParams);

    // Recent activity from audit logs - filtered by organization
    const recentActivityQuery = await pool.query(`
      SELECT action, entity_type, entity_id, user_id, username, details, created_at
      FROM audit_logs
      WHERE user_id IN (SELECT id FROM auth_users WHERE organization_id = $1)
      ORDER BY created_at DESC
      LIMIT 20
    `, [organizationId]);

    // Upcoming license expirations
    const upcomingExpirationsQuery = await pool.query(`
      SELECT license_name, software_name, vendor, expiration_date,
             EXTRACT(DAY FROM (expiration_date - CURRENT_DATE)) as days_remaining
      FROM licenses
      WHERE expiration_date IS NOT NULL
        AND expiration_date > CURRENT_DATE
        AND expiration_date <= CURRENT_DATE + INTERVAL '90 days'
      ORDER BY expiration_date ASC
      LIMIT 10
    `);

    // Active contracts
    const activeContractsQuery = await pool.query(`
      SELECT COUNT(*) as count
      FROM contracts
      WHERE status = 'Active'
    `);

    // Security alerts (unresolved)
    const unresolvedAlertsQuery = await pool.query(`
      SELECT COUNT(*) as count
      FROM security_alerts
      WHERE status = 'active'
    `);

    return {
      overview: {
        ...overviewQuery.rows[0],
        active_contracts: parseInt(activeContractsQuery.rows[0].count),
        unresolved_alerts: parseInt(unresolvedAlertsQuery.rows[0].count)
      },
      assetsByCategory: assetsByCategoryQuery.rows,
      assetsByStatus: assetsByStatusQuery.rows,
      recentActivity: recentActivityQuery.rows,
      upcomingExpirations: upcomingExpirationsQuery.rows,
      userRole: role // Include role in response so UI can adapt
    };
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    throw error;
  }
}

/**
 * Export data to CSV format
 */
export async function getExportData(type = 'all') {
  try {
    const data = {};

    if (type === 'all' || type === 'assets') {
      const assetsResult = await pool.query(`
        SELECT asset_tag, asset_type, category, model, manufacturer, serial_number,
               status, purchase_date, cost, warranty_expiration, location, assigned_to
        FROM assets
        ORDER BY created_at DESC
      `);
      data.assets = assetsResult.rows;
    }

    if (type === 'all' || type === 'licenses') {
      const licensesResult = await pool.query(`
        SELECT license_name, software_name, vendor, license_type, license_key,
               expiration_date, quantity, status, cost
        FROM licenses
        ORDER BY created_at DESC
      `);
      data.licenses = licensesResult.rows;
    }

    if (type === 'all' || type === 'contracts') {
      const contractsResult = await pool.query(`
        SELECT contract_name, vendor, contract_type, start_date, end_date,
               value, status, renewal_terms
        FROM contracts
        ORDER BY created_at DESC
      `);
      data.contracts = contractsResult.rows;
    }

    if (type === 'all' || type === 'consumables') {
      const consumablesResult = await pool.query(`
        SELECT name, category, quantity, min_quantity, unit, unit_cost,
               location, supplier, sku
        FROM consumables
        ORDER BY name ASC
      `);
      data.consumables = consumablesResult.rows;
    }

    return data;
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

// ============ PAYMENTS (PayPal) ============

export async function createPaymentRecord({
  orderId,
  captureId = null,
  userId = null,
  amountCents,
  currency,
  status,
  intent = 'CAPTURE',
  payerEmail = null,
  payerName = null,
  description = null,
  metadata = {}
}) {
  try {
    const result = await pool.query(
      `INSERT INTO payments (
         order_id, capture_id, user_id, amount_cents, currency,
         status, intent, payer_email, payer_name, description, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (order_id) DO UPDATE SET
         capture_id = COALESCE(EXCLUDED.capture_id, payments.capture_id),
         status = EXCLUDED.status,
         payer_email = COALESCE(EXCLUDED.payer_email, payments.payer_email),
         payer_name = COALESCE(EXCLUDED.payer_name, payments.payer_name),
         metadata = COALESCE(EXCLUDED.metadata, payments.metadata),
         updated_at = NOW()
       RETURNING *` ,
      [orderId, captureId, userId, amountCents, currency, status, intent, payerEmail, payerName, description, metadata]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating payment record:', error);
    throw error;
  }
}

export async function getPaymentByOrderId(orderId) {
  try {
    const result = await pool.query('SELECT * FROM payments WHERE order_id = $1', [orderId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching payment by order id:', error);
    throw error;
  }
}

export async function getPaymentByCaptureId(captureId) {
  try {
    const result = await pool.query('SELECT * FROM payments WHERE capture_id = $1', [captureId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching payment by capture id:', error);
    throw error;
  }
}

export async function getPaymentsForUser(userId, { limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  return withRLSContext(userId, async (client) => {
    const result = await client.query(
      `SELECT id, order_id, capture_id, 
              user_id, amount_cents, currency, status, intent,
              payer_email, payer_name, 
              description, created_at, updated_at
         FROM payments
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, safeLimit, safeOffset]
    );
    return result.rows;
  });
}

export async function getAllPayments({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const result = await pool.query(
    `SELECT id, order_id, capture_id, 
            user_id, amount_cents, currency, status, intent,
            payer_email, payer_name, 
            description, created_at, updated_at
       FROM payments
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset]
  );
  return result.rows;
}

export async function updatePaymentStatus(orderId, updates = {}) {
  const fields = [];
  const values = [];
  if (updates.status) {
    fields.push(`status = $${fields.length + 1}`);
    values.push(updates.status);
  }
  if (updates.captureId) {
    fields.push(`capture_id = $${fields.length + 1}`);
    values.push(updates.captureId);
  }
  if (updates.payerEmail) {
    fields.push(`payer_email = $${fields.length + 1}`);
    values.push(updates.payerEmail);
  }
  if (updates.metadata) {
    fields.push(`metadata = $${fields.length + 1}`);
    values.push(updates.metadata);
  }

  if (fields.length === 0) return null;

  values.push(orderId);
  const sql = `UPDATE payments SET ${fields.join(', ')}, updated_at = NOW() WHERE order_id = $${fields.length + 1} RETURNING *`;
  try {
    const result = await pool.query(sql, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating payment status:', error);
    throw error;
  }
}

export async function logWebhookEvent(eventId, eventType, status, payload) {
  try {
    const result = await pool.query(
      `INSERT INTO webhook_events (event_id, event_type, status, payload)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING id`,
      [eventId, eventType, status, payload]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error logging webhook event:', error);
    throw error;
  }
}

export async function markWebhookProcessed(eventId, status = 'processed') {
  try {
    await pool.query(
      `UPDATE webhook_events SET status = $1, processed_at = NOW() WHERE event_id = $2`,
      [status, eventId]
    );
  } catch (error) {
    console.error('Error updating webhook event status:', error);
    throw error;
  }
}

// ============ BILLING/ORGANIZATION QUERIES ============

/**
 * Get current organization's billing status
 */
export async function getOrganizationBilling(organizationId, client = null) {
  const queryClient = client || pool;
  try {
    const result = await queryClient.query(
      `SELECT
        id, name, domain, plan,
        billing_tier, subscription_status, paypal_subscription_id,
        subscription_started_at, subscription_current_period_end,
        subscription_updated_at, created_at, updated_at
       FROM organizations
       WHERE id = $1`,
      [organizationId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching organization billing:', error);
    throw error;
  }
}

/**
 * Set/update organization subscription status and billing tier
 */
export async function setOrganizationSubscription(organizationId, updates = {}, client = null) {
  const queryClient = client || pool;
  const fields = [];
  const values = [];
  let paramCount = 1;

  if (updates.paypalSubscriptionId !== undefined) {
    fields.push(`paypal_subscription_id = $${paramCount++}`);
    values.push(updates.paypalSubscriptionId || null);
  }
  if (updates.subscriptionStatus !== undefined) {
    fields.push(`subscription_status = $${paramCount++}`);
    values.push(updates.subscriptionStatus || null);
  }
  if (updates.subscriptionStartedAt !== undefined) {
    fields.push(`subscription_started_at = $${paramCount++}`);
    values.push(updates.subscriptionStartedAt || null);
  }
  if (updates.subscriptionCurrentPeriodEnd !== undefined) {
    fields.push(`subscription_current_period_end = $${paramCount++}`);
    values.push(updates.subscriptionCurrentPeriodEnd || null);
  }
  if (updates.billingTier !== undefined) {
    fields.push(`billing_tier = $${paramCount++}`);
    values.push(updates.billingTier || 'regular');
  }

  if (fields.length === 0) return null;

  fields.push(`subscription_updated_at = NOW()`);
  fields.push(`updated_at = NOW()`);
  values.push(organizationId);

  try {
    const sql = `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING id, name, domain, plan, billing_tier, subscription_status, paypal_subscription_id, subscription_started_at, subscription_current_period_end, created_at, updated_at`;
    const result = await queryClient.query(sql, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating organization subscription:', error);
    throw error;
  }
}

/**
 * Set billing tier for an organization (admin/system context)
 */
export async function setOrganizationBillingTier(organizationId, updates = {}, client = null) {
  const queryClient = client || pool;
  const fields = [];
  const values = [];
  let paramCount = 1;

  if (updates.billingTier !== undefined) {
    fields.push(`billing_tier = $${paramCount++}`);
    values.push(updates.billingTier);
  }
  if (updates.subscriptionStatus !== undefined) {
    fields.push(`subscription_status = $${paramCount++}`);
    values.push(updates.subscriptionStatus);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = NOW()`);
  values.push(organizationId);

  try {
    const sql = `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING id, name, domain, plan, billing_tier, subscription_status, created_at, updated_at`;
    const result = await queryClient.query(sql, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating organization billing tier:', error);
    throw error;
  }
}

