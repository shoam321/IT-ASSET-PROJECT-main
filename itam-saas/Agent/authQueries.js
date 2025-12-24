import pool from './db.js';
import bcrypt from 'bcryptjs';

/**
 * Create a new user
 */
export async function createAuthUser(username, email, password, fullName = null, role = 'user') {
  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO auth_users (username, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [username, email, passwordHash, fullName, role]
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
      'SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM auth_users WHERE id = $1',
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
