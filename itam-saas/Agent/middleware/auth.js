import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable not set!');
  console.error('Set JWT_SECRET in your environment before starting the server.');
  process.exit(1);
}

/**
 * Middleware to verify JWT token and protect routes
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Normalize token payload for backwards/forwards compatibility.
    // Many routes historically use req.user.id, while tokens carry userId.
    const normalized = { ...decoded };
    if (normalized.id === undefined && normalized.userId !== undefined) {
      normalized.id = normalized.userId;
    }
    if (normalized.userId === undefined && normalized.id !== undefined) {
      normalized.userId = normalized.id;
    }
    if (typeof normalized.role === 'string') {
      normalized.role = normalized.role.toLowerCase();
    }

    req.user = normalized; // Add user info to request
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(403).json({ error: 'Invalid token.' });
  }
};

/**
 * Middleware to check if user has admin role
 */
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin rights required.' });
  }
  next();
};

/**
 * Get permissions for a role
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * ROLE-BASED ACCESS CONTROL (RBAC) SYSTEM DOCUMENTATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ADMIN ROLE:
 * - 'read:all_devices': Can view all devices from all users
 * - 'write:all_devices': Can create/update any device
 * - 'manage:users': Can create/edit/delete users (future feature)
 * - Also includes all user permissions
 * 
 * USER ROLE (default):
 * - 'read:own_devices': Can only view their own devices
 * - 'write:own_devices': Can only create/update their own devices
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * WHO IS THE ADMIN?
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * CREATING THE FIRST ADMIN:
 * 1) Preferred: Run `node create-admin.js` to create the first admin.
 *    - You can pass username/email/password/fullName as arguments.
 *    - The script supports using `ADMIN_INITIAL_PASSWORD` from env.
 * 
 * 2) Dev-only bootstrap: set `AUTO_CREATE_ADMIN=true` before starting the server.
 *    - If no admin exists, the server will create `admin`.
 *    - Password source:
 *      - `ADMIN_INITIAL_PASSWORD` if provided, otherwise a strong random password is generated
 *        and printed once to the console.
 *    - Disable `AUTO_CREATE_ADMIN` after bootstrap.
 * 
 * Admin users are stored in the `auth_users` table with `role='admin'`.
 * 
 * WHAT HAPPENS DURING MIGRATION:
 * - All existing devices get assigned to first admin user (user_id = admin's ID)
 * - This ensures no orphaned data after adding multi-tenancy
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * HOW PERMISSIONS ARE USED:
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 1. During LOGIN (/api/auth/login):
 *    - User credentials verified
 *    - generateToken() calls getRolePermissions(user.role)
 *    - Permissions array added to JWT token
 *    - Token sent to client (stored in localStorage)
 * 
 * 2. During API REQUESTS:
 *    - Client sends JWT in Authorization header: "Bearer <token>"
 *    - authenticateToken() middleware verifies token
 *    - authorize() middleware checks permissions
 *    - Example: authorize('read:all_devices') → Only admins pass
 * 
 * 3. In DATABASE (Row-Level Security):
 *    - setCurrentUserId() called with user.userId from JWT
 *    - PostgreSQL RLS policies check:
 *      - Is user admin? → Show all data
 *      - Is user regular? → Show only WHERE user_id = current_user_id
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * SECURITY BENEFITS:
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * DEFENSE IN DEPTH (Multiple security layers):
 * 1. JWT Permission Check (App Layer): Fast, prevents API calls
 * 2. PostgreSQL RLS (Database Layer): Even if app has bugs, DB enforces rules
 * 3. User ID in JWT (Signed): Can't be tampered, cryptographically verified
 * 
 * ZERO-TRUST MODEL:
 * - Every request is authenticated (JWT required)
 * - Every query is filtered (RLS enforced at DB level)
 * - Admin access is explicit (must have role='admin')
 */
const getRolePermissions = (role) => {
  const permissions = {
    admin: ['read:all_devices', 'write:all_devices', 'manage:users', 'read:own_devices', 'write:own_devices'],
    user: ['read:own_devices', 'write:own_devices']
  };
  return permissions[role] || permissions.user;
};

/**
 * Middleware to check if user has required permissions
 */
export const authorize = (...allowedPermissions) => {
  return (req, res, next) => {
    const userPermissions = req.user.permissions || getRolePermissions(req.user.role);
    
    const hasPermission = allowedPermissions.some(permission =>
      userPermissions.includes(permission)
    );
    
    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions',
        required: allowedPermissions,
        userHas: userPermissions
      });
    }
    
    next();
  };
};

/**
 * Generate JWT token for a user
 * 
 * JWT TOKEN STRUCTURE:
 * After successful login, user receives a JWT token containing:
 * {
 *   userId: 123,                    // User's ID from auth_users table
 *   username: "john.doe",            // Username for display
 *   email: "john@example.com",      // Email address
 *   role: "user" or "admin",        // User's role (determines permissions)
 *   permissions: ["read:own_devices", ...],  // Array of permission strings
 *   exp: 1735123456                 // Token expiration timestamp (auto-added by jwt.sign)
 * }
 * 
 * WHY INCLUDE PERMISSIONS IN JWT:
 * - Avoids database lookup on every single API request (performance)
 * - Fast permission checking in authorize() middleware
 * - Token is cryptographically signed with JWT_SECRET, can't be tampered
 * - If someone tries to change role/permissions, signature verification fails
 * 
 * SECURITY CONSIDERATIONS:
 * - JWT_SECRET must be strong (set in .env: long random string)
 * - Token expires after 7 days (then user must login again)
 * - Token stored in localStorage on client-side
 * - Sent as Authorization header: "Bearer <token>"
 * 
 * ROLE ASSIGNMENT:
 * - Admin: Created via `node create-admin.js` (recommended) or `AUTO_CREATE_ADMIN=true` (dev-only)
 * - User: Default role when registering via /api/auth/register
 * - Role stored in auth_users.role column in database
 * - Role determines which permissions are added to token
 * 
 * IMPORTANT FIX LEARNED:
 * - Changed from { id, username, ... } to { userId, username, ... }
 * - Frontend code expects "userId" key, not "id"
 * - Inconsistency caused authentication bugs during multi-tenancy implementation
 */
export const generateToken = (user) => {
  const permissions = getRolePermissions(user.role);
  
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: permissions
    },
    JWT_SECRET,
    { expiresIn: '7d' } // Token expires in 7 days
  );
};
