import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

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
    req.user = decoded; // Add user info to request
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
