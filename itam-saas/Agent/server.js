import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import * as db from './queries.js';
import * as authQueries from './authQueries.js';
import { authenticateToken, generateToken } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const allowedOrigins = process.env.REACT_APP_URL 
  ? process.env.REACT_APP_URL.split(',').map(origin => origin.trim())
  : ['https://it-asset-project.vercel.app'];
console.log('🔧 CORS Origins:', allowedOrigins);

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed or is a vercel.app domain
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Initialize database on startup
async function startServer() {
  let retries = 5;
  while (retries > 0) {
    try {
      console.log(`🔄 Attempting to initialize database (${6 - retries}/5)...`);
      await db.initDatabase();
      console.log('✅ Database initialized successfully');
      return;
    } catch (error) {
      retries--;
      console.error(`❌ Database init failed (${retries} retries left):`, error.message);
      if (retries > 0) {
        const waitTime = 3000; // 3 seconds
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  console.warn('⚠️ Database initialization failed after retries - server starting without DB');
}

// --- ROUTES ---

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== AUTHENTICATION ROUTES =====

// Register new user
app.post('/api/auth/register', [
  body('username').trim().isLength({ min: 3, max: 100 }).withMessage('Username must be 3-100 characters'),
  body('email').trim().isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fullName').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, email, password, fullName } = req.body;
    
    const user = await authQueries.createAuthUser(username, email, password, fullName, 'user');
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
app.post('/api/auth/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, password } = req.body;
    
    const user = await authQueries.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const isValidPassword = await authQueries.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    await authQueries.updateLastLogin(user.id);
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user info (protected route)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await authQueries.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
      lastLogin: user.last_login
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Logout (client-side token removal, but endpoint for tracking)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ===== ASSET ROUTES (Protected) =====

// Get all assets
app.get('/api/assets', authenticateToken, async (req, res) => {
  try {
    const assets = await db.getAllAssets();
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get asset by ID
app.get('/api/assets/:id', authenticateToken, async (req, res) => {
  try {
    const asset = await db.getAssetById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search assets
app.get('/api/assets/search/:query', authenticateToken, async (req, res) => {
  try {
    const assets = await db.searchAssets(req.params.query);
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get asset statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getAssetStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new asset
app.post('/api/assets', authenticateToken, async (req, res) => {
  try {
    const asset = await db.createAsset(req.body);
    res.status(201).json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update asset
app.put('/api/assets/:id', authenticateToken, async (req, res) => {
  try {
    const asset = await db.updateAsset(req.params.id, req.body);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete asset
app.delete('/api/assets/:id', authenticateToken, async (req, res) => {
  try {
    const asset = await db.deleteAsset(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json({ message: 'Asset deleted', asset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- LICENSES ROUTES ---

// Get all licenses
app.get('/api/licenses', authenticateToken, async (req, res) => {
  try {
    const licenses = await db.getAllLicenses();
    res.json(licenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search licenses
app.get('/api/licenses/search/:query', authenticateToken, async (req, res) => {
  try {
    const licenses = await db.searchLicenses(req.params.query);
    res.json(licenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new license
app.post('/api/licenses', authenticateToken, async (req, res) => {
  try {
    console.log('📝 Creating license with data:', req.body);
    const license = await db.createLicense(req.body);
    console.log('✅ License created:', license);
    res.status(201).json(license);
  } catch (error) {
    console.error('❌ License creation error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Update license
app.put('/api/licenses/:id', authenticateToken, async (req, res) => {
  try {
    console.log('📝 Updating license', req.params.id, 'with data:', req.body);
    const license = await db.updateLicense(req.params.id, req.body);
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    console.log('✅ License updated:', license);
    res.json(license);
  } catch (error) {
    console.error('❌ License update error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Delete license
app.delete('/api/licenses/:id', authenticateToken, async (req, res) => {
  try {
    const license = await db.deleteLicense(req.params.id);
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    res.json({ message: 'License deleted', license });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- USERS ROUTES ---

// Get all users
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search users
app.get('/api/users/search/:query', authenticateToken, async (req, res) => {
  try {
    const users = await db.searchUsers(req.params.query);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new user
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const user = await db.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update user
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await db.updateUser(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await db.deleteUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CONTRACTS ROUTES ---

// Get all contracts
app.get('/api/contracts', authenticateToken, async (req, res) => {
  try {
    const contracts = await db.getAllContracts();
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search contracts
app.get('/api/contracts/search/:query', authenticateToken, async (req, res) => {
  try {
    const contracts = await db.searchContracts(req.params.query);
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new contract
app.post('/api/contracts', authenticateToken, async (req, res) => {
  try {
    const contract = await db.createContract(req.body);
    res.status(201).json(contract);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update contract
app.put('/api/contracts/:id', authenticateToken, async (req, res) => {
  try {
    const contract = await db.updateContract(req.params.id, req.body);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json(contract);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete contract
app.delete('/api/contracts/:id', authenticateToken, async (req, res) => {
  try {
    const contract = await db.deleteContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json({ message: 'Contract deleted', contract });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize and start server
startServer();

// Export for Vercel
export default app;

// Start listening (both production and development)
app.listen(PORT, () => {
  console.log(`\n🚀 IT Asset Tracker Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health\n`);
});
