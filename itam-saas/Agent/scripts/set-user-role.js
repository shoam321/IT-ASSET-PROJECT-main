import pool from '../db.js';
import { findUserById } from '../authQueries.js';

async function setRole(userId, role) {
  if (!userId || !role) {
    throw new Error('Usage: set-user-role <userId> <role>');
  }
  const normalized = String(role).toLowerCase();
  const allowed = ['admin', 'manager', 'analyst', 'user'];
  if (!allowed.includes(normalized)) {
    throw new Error(`Invalid role: ${role}. Allowed: ${allowed.join(', ')}`);
  }
  await pool.query('UPDATE auth_users SET role = $2 WHERE id = $1', [userId, normalized]);
  const user = await findUserById(userId);
  return user;
}

async function main() {
  const args = process.argv.slice(2);
  const userId = Number(args[0]);
  const role = args[1];
  try {
    const updated = await setRole(userId, role);
    console.log('✅ Updated role:', { id: updated.id, username: updated.username, role: updated.role });
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to update role:', err.message || err);
    process.exit(1);
  }
}

main();
