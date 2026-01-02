import pool from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Create a new user
 *
 * Security:
 * - Passwords are hashed with bcrypt (`bcryptjs`).
 * - Cost factor is intentionally set to 12 for better resistance against offline cracking.
 */
export async function createAuthUser(username, email, password, fullName = null, role = 'admin', organizationId = null, orgRole = 'owner', firstName = null, lastName = null) {
  try {
    const enforcedRole = 'admin'; // Single-role system: force admin for every user
    const effectiveOrgRole = orgRole || 'owner';

    const salt = await bcrypt.genSalt(12); // Increased salt rounds from 10 to 12
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Calculate trial dates (30-day trial)
    const trialStartedAt = new Date();
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    const result = await pool.query(
      `INSERT INTO auth_users (username, email, password_hash, full_name, role, organization_id, org_role, first_name, last_name, trial_started_at, trial_ends_at, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
       RETURNING id, username, email, full_name, role, organization_id, org_role, is_active, created_at, first_name, last_name, trial_started_at, trial_ends_at, onboarding_completed`,
      [username, email, passwordHash, fullName, enforcedRole, organizationId, effectiveOrgRole, firstName, lastName, trialStartedAt, trialEndsAt]
    );

    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      if (error.constraint === 'auth_users_username_key') {
        throw new Error('Username already exists');
      }
      if (error.constraint === 'auth_users_email_key') {
        throw new Error('Email already exists');
      }
    }
    throw error;
  }
}

/**
 * Create organization and first owner user in a single transaction
 */
export async function createOrganizationWithOwner(orgName, orgDomain, username, email, password, fullName = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orgResult = await client.query(
      `INSERT INTO organizations (name, domain, billing_tier, subscription_status)
       VALUES ($1, $2, 'pro', 'active')
       RETURNING id, name, domain, billing_tier, subscription_status`,
      [orgName, orgDomain || null]
    );

    const organizationId = orgResult.rows[0].id;

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const userResult = await client.query(
      `INSERT INTO auth_users (username, email, password_hash, full_name, role, organization_id, org_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, email, full_name, role, organization_id, org_role, is_active, created_at`,
      [username, email, passwordHash, fullName, 'admin', organizationId, 'owner']
    );

    await client.query('COMMIT');

    return { organization: orgResult.rows[0], user: userResult.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      if (error.constraint === 'auth_users_username_key') {
        throw new Error('Username already exists');
      }
      if (error.constraint === 'auth_users_email_key') {
        throw new Error('Email already exists');
      }
      if (error.constraint === 'organizations_domain_key') {
        throw new Error('Organization domain already exists');
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Find user by username
 */
export async function findUserByUsername(username) {
  try {
    const result = await pool.query(
      'SELECT * FROM auth_users WHERE username = $1',
      [username]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error finding user by username:', error);
    throw error;
  }
}

/**
 * Find user by email
 */
export async function findUserByEmail(email) {
  try {
    const result = await pool.query(
      'SELECT * FROM auth_users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error finding user by email:', error);
    throw error;
  }
}

/**
 * Find user by ID
 */
export async function findUserById(id) {
  try {
    const result = await pool.query(
      `SELECT id, username, email, full_name, role, is_active, created_at, last_login,
              organization_id, org_role, onboarding_completed, trial_started_at, trial_ends_at
       FROM auth_users
       WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error finding user by ID:', error);
    throw error;
  }
}

/**
 * Verify password
 */
export async function verifyPassword(plainPassword, passwordHash) {
  return await bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Authenticate user
 */
export async function authenticateUser(username, password) {
  try {
    const user = await findUserByUsername(username);
    if (!user) {
      throw new Error('Invalid username or password');
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid username or password');
    }

    if (!user.is_active) {
      throw new Error('Account is disabled');
    }

    return user;
  } catch (error) {
    console.error('Error authenticating user:', error);
    throw error;
  }
}

/**
 * Update last login time
 */
export async function updateLastLogin(userId) {
  try {
    await pool.query(
      'UPDATE auth_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  } catch (error) {
    console.error('Error updating last login:', error);
  }
}

/**
 * Get all users (admin only)
 */
export async function getAllAuthUsers() {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM auth_users ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching auth users:', error);
    throw error;
  }
}

/**
 * Ensure default admin exists
 *
 * IMPORTANT (SaaS-safe defaults):
 * - This function does NOTHING unless `AUTO_CREATE_ADMIN=true`.
 * - Intended for local/dev bootstrap only.
 * - In production, create admins explicitly using `node create-admin.js`.
 *
 * Password source when bootstrap is enabled and no admin exists:
 * - `ADMIN_INITIAL_PASSWORD` if provided, otherwise a strong password is generated
 *   and printed once to the server console.
 */
export async function ensureDefaultAdmin() {
  try {
    if (process.env.AUTO_CREATE_ADMIN !== 'true') {
      return;
    }

    const result = await pool.query("SELECT count(*) FROM auth_users WHERE role = 'admin'");
    const count = parseInt(result.rows[0].count);
    
    if (count === 0) {
      console.warn('No admin users found. AUTO_CREATE_ADMIN=true so creating an admin user...');

      const providedPassword = process.env.ADMIN_INITIAL_PASSWORD;
      const generatedPassword = crypto.randomBytes(18).toString('base64url');
      const passwordToUse = providedPassword || generatedPassword;

      await createAuthUser(
        'admin',
        'admin@itasset.local',
        passwordToUse,
        'System Administrator',
        'admin'
      );

      if (!providedPassword) {
        console.warn('Admin user created: admin');
        console.warn(`Generated password (store it now): ${generatedPassword}`);
        console.warn('Set ADMIN_INITIAL_PASSWORD to control this, and disable AUTO_CREATE_ADMIN after bootstrap.');
      } else {
        console.warn('Admin user created: admin (password from ADMIN_INITIAL_PASSWORD)');
      }
    }
  } catch (error) {
    console.error('Error ensuring default admin:', error);
  }
}

/**
 * Create an organization and assign the existing user as its owner.
 *
 * Constraints:
 * - Only allowed when the user currently has organization_id IS NULL.
 * - Does NOT change the user's global role (admin/user).
 */
export async function createOrganizationForExistingUser(userId, orgName, orgDomain = null, client = null) {
  if (!userId) throw new Error('userId is required');
  if (!orgName || !String(orgName).trim()) throw new Error('orgName is required');

  const externalClient = client;
  const localClient = externalClient ? null : await pool.connect();
  const c = externalClient || localClient;

  const trialStartedAt = new Date();
  const trialEndsAt = new Date(trialStartedAt.getTime());
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  try {
    if (!externalClient) {
      await c.query('BEGIN');
    }

    const userRes = await c.query(
      'SELECT id, organization_id FROM auth_users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) throw new Error('User not found');
    if (user.organization_id) throw new Error('User is already assigned to an organization');

    const orgRes = await c.query(
      `INSERT INTO organizations (name, domain, plan, billing_tier, subscription_status, subscription_started_at, subscription_current_period_end)
       VALUES ($1, $2, 'trial', 'pro', 'trial', $3, $4)
       RETURNING id, name, domain, plan, billing_tier, subscription_status, subscription_started_at, subscription_current_period_end, created_at`,
      [String(orgName).trim(), orgDomain || null, trialStartedAt, trialEndsAt]
    );

    const organizationId = orgRes.rows[0].id;

    await c.query(
      `UPDATE auth_users
       SET organization_id = $2, org_role = 'owner', role = 'admin'
       WHERE id = $1 AND organization_id IS NULL`,
      [userId, organizationId]
    );

    if (!externalClient) {
      await c.query('COMMIT');
    }

    return orgRes.rows[0];
  } catch (error) {
    if (!externalClient) {
      await c.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (localClient) {
      localClient.release();
    }
  }
}
