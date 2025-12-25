import pool from './db.js';

/**
 * Set the current user ID for PostgreSQL Row-Level Security (RLS)
 * 
 * HOW IT WORKS:
 * - Sets PostgreSQL session variable 'app.current_user_id' = userId from JWT
 * - RLS policies check this variable using: current_setting('app.current_user_id', true)::integer
 * - Database automatically filters queries based on user_id and role
 * 
 * ADMIN vs USER ACCESS:
 * - Admin users (role='admin'): See ALL devices and usage data from ALL users
 * - Regular users (role='user'): See ONLY their own devices and usage data
 * - RLS policies defined in migrations/add-multi-tenancy.sql
 * 
 * WHO IS ADMIN:
 * - Created using: node create-admin.js (default: admin/admin@itasset.local/admin123)
 * - First admin must be created manually before system use
 * - Admins can create more users/admins via API (future feature)
 * 
 * IMPORTANT FIXES LEARNED:
 * - Use SET (not SET LOCAL) because SET LOCAL only works in transactions
 * - With connection pooling, SET persists for the connection session
 * - Must call this BEFORE any database query that needs user filtering
 * 
 * SECURITY BENEFITS:
 * - Defense-in-depth: Even if app code has bugs, database enforces access rules
 * - Database-level security prevents SQL injection from bypassing filters
 * - Zero-trust: Every query is filtered at database level, not app level
 */
export async function setCurrentUserId(userId) {
  try {
    await pool.query('SET app.current_user_id = $1', [userId]);
  } catch (error) {
    console.error('Error setting current user ID:', error);
    throw error;
  }
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
      ) as contracts_exists;
    `);
    
    const { assets_exists, licenses_exists, users_exists, contracts_exists } = tablesCheck.rows[0];
    
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
 */
export async function getAllAssets() {
  try {
    const result = await pool.query('SELECT * FROM assets ORDER BY created_at DESC');
    return result.rows;
  } catch (error) {
    console.error('Error fetching assets:', error);
    throw error;
  }
}

/**
 * Get asset by ID
 */
export async function getAssetById(id) {
  try {
    const result = await pool.query('SELECT * FROM assets WHERE id = $1', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching asset:', error);
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
  const { asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status, cost, discovered } = assetData;
  
  try {
    const result = await pool.query(
      `INSERT INTO assets (asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status, cost, discovered)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [asset_tag, asset_type, manufacturer, model, serial_number, assigned_user_name, status || 'In Use', cost || 0, discovered || false]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating asset:', error);
    console.error('Error details:', error.message, error.code, error.detail);
    throw new Error(`Failed to create asset: ${error.message}`);
  }
}

/**
 * Update asset
 */
export async function updateAsset(id, assetData) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  for (const [key, value] of Object.entries(assetData)) {
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
    const query = `UPDATE assets SET ${fields.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`;
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
export async function deleteAsset(id) {
  try {
    const result = await pool.query('DELETE FROM assets WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting asset:', error);
    throw error;
  }
}

/**
 * Search assets
 */
export async function searchAssets(query) {
  try {
    const searchTerm = `%${query}%`;
    const result = await pool.query(
      `SELECT * FROM assets 
       WHERE asset_tag ILIKE $1 
          OR manufacturer ILIKE $1 
          OR model ILIKE $1 
          OR assigned_user_name ILIKE $1
       ORDER BY created_at DESC`,
      [searchTerm]
    );
    return result.rows;
  } catch (error) {
    console.error('Error searching assets:', error);
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
  const { user_name, email, department, phone, role, status, notes } = userData;
  try {
    const result = await pool.query(
      `INSERT INTO users (user_name, email, department, phone, role, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user_name, email, department, phone, role, status || 'Active', notes]
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
 * Search users
 */
export async function searchUsers(query) {
  try {
    const searchTerm = `%${query}%`;
    const result = await pool.query(
      `SELECT * FROM users 
       WHERE user_name ILIKE $1 
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
 */
export async function upsertDevice(deviceData) {
  const { device_id, hostname, os_name, os_version, user_id } = deviceData;
  
  try {
    const result = await pool.query(
      `INSERT INTO devices (device_id, hostname, os_name, os_version, user_id, last_seen, status)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'Active')
       ON CONFLICT (device_id) 
       DO UPDATE SET 
         hostname = COALESCE($2, devices.hostname),
         os_name = COALESCE($3, devices.os_name),
         os_version = COALESCE($4, devices.os_version),
         user_id = COALESCE($5, devices.user_id),
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
 */
export async function insertUsageData(usageData) {
  const { device_id, app_name, window_title, duration, timestamp, user_id } = usageData;
  
  try {
    const result = await pool.query(
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
