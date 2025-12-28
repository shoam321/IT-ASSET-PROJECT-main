import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import pool, { dbAsyncLocalStorage } from './db.js';
import * as db from './queries.js';
import * as authQueries from './authQueries.js';
import { authenticateToken, generateToken, requireAdmin } from './middleware/auth.js';
import { initializeAlertService, shutdownAlertService } from './alertService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Startup diagnostics (do not print secrets)
console.log('🔧 Environment:', {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT,
  HAS_DATABASE_URL: Boolean(process.env.DATABASE_URL),
  HAS_JWT_SECRET: Boolean(process.env.JWT_SECRET),
  HAS_SESSION_SECRET: Boolean(process.env.SESSION_SECRET)
});

try {
  if (process.env.DATABASE_URL) {
    const dbUrl = new URL(process.env.DATABASE_URL);
    console.log('🔧 Database target:', {
      host: dbUrl.hostname,
      port: dbUrl.port || '(default)',
      database: dbUrl.pathname?.replace('/', '') || '(unknown)'
    });
  }
} catch {
  console.warn('⚠️ DATABASE_URL is set but could not be parsed as a URL');
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads', 'receipts');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: images, PDF, Word, Excel'));
    }
  }
});

// Socket.IO configuration
const io = new Server(httpServer, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const allowedOrigins = process.env.REACT_APP_URL 
        ? process.env.REACT_APP_URL.split(',').map(o => o.trim())
        : [
            'https://it-asset-project.vercel.app',
            'http://localhost:3000',
            'http://localhost:5000'
          ];
      
      // Allow any Vercel deployment
      if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('❌ CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 WebSocket client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 WebSocket client disconnected:', socket.id);
  });
});

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window per IP
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many authentication attempts. Please try again in 15 minutes.'
    });
  }
});

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

// Bind a single DB connection to each /api request.
// Needed for PostgreSQL RLS that relies on session variables (set_config).
app.use('/api', async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
  } catch (error) {
    console.error('Failed to acquire DB client:', error);
    return res.status(500).json({ error: 'Database connection error' });
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    try {
      client.release();
    } catch {
      // ignore
    }
  };

  res.on('finish', release);
  res.on('close', release);

  dbAsyncLocalStorage.run({ client }, () => {
    next();
  });
});

// Session configuration for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await authQueries.findUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy (optional)
// If GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not set, we skip registration so local
// dev and non-SSO deployments don't crash on startup.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://it-asset-project-production.up.railway.app/api/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await db.findOrCreateGoogleUser(profile);
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  ));
} else {
  console.warn('⚠️ Google SSO not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)');
}

// Request logging middleware
// - Adds an `x-request-id` header to every response
// - Logs: timestamp, requestId, method, url, status, duration
// - Helps correlate client errors with server logs quickly
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startMs = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startMs;
    console.log(
      `[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`
    );
  });

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
      
      // Initialize alert service after database is ready
      try {
        await initializeAlertService(io);
        console.log('✅ Alert Service initialized successfully');
      } catch (alertError) {
        console.error('⚠️ Alert Service failed to initialize:', alertError.message);
      }
      
      // Set up automatic alert cleanup every 5 hours
      const CLEANUP_INTERVAL = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
      setInterval(async () => {
        try {
          await db.cleanupOldAlerts(5);
        } catch (error) {
          console.error('⚠️ Alert cleanup failed:', error.message);
        }
      }, CLEANUP_INTERVAL);
      console.log('✅ Alert cleanup scheduled (every 5 hours)');
      
      // Run initial cleanup
      try {
        await db.cleanupOldAlerts(5);
      } catch (error) {
        console.error('⚠️ Initial alert cleanup failed:', error.message);
      }

      // Ensure default admin exists
      try {
        await authQueries.ensureDefaultAdmin();
      } catch (error) {
        console.error('⚠️ Failed to ensure default admin:', error.message);
      }
      
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
app.post('/api/auth/register', authLimiter, [
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
app.post('/api/auth/login', authLimiter, [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, password } = req.body;
    const user = await authQueries.authenticateUser(username, password);
    
    const token = generateToken(user);
    
    // Log audit event
    await db.logAuditEvent('users', user.id, 'LOGIN', null, { logged_in: true }, {
      userId: user.id,
      username: user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
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
    console.error('Login error:', error.message);
    if (error.message === 'Invalid username or password' || error.message === 'Account is disabled') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

// Google OAuth Routes
app.get('/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/api/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: process.env.FRONTEND_URL || 'https://it-asset-project.vercel.app',
    session: false 
  }),
  async (req, res) => {
    try {
      // Generate JWT token
      const token = generateToken(req.user);
      
      // Log audit event
      await db.logAuditEvent('users', req.user.id, 'LOGIN', null, { logged_in_via: 'google' }, {
        userId: req.user.id,
        username: req.user.username,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'https://it-asset-project.vercel.app';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'https://it-asset-project.vercel.app';
      res.redirect(`${frontendUrl}?error=auth_failed`);
    }
  }
);

// Get current user info (protected route)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const user = await authQueries.findUserById(userId);
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

// --- AUDIT TRAIL ENDPOINTS ---

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  let text = value;
  if (typeof text === 'object') {
    try {
      text = JSON.stringify(text);
    } catch {
      text = String(text);
    }
  } else {
    text = String(text);
  }

  // Escape double-quotes by doubling them; wrap everything in quotes.
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

function toCsv(rows, columns) {
  const header = columns.map(csvEscape).join(',');
  const lines = rows.map((row) => columns.map((col) => csvEscape(row?.[col])).join(','));
  return [header, ...lines].join('\r\n') + '\r\n';
}

function buildAuditFiltersFromQuery(query) {
  const MAX_LIMIT = 5000;
  const parsedLimit = query.limit ? parseInt(query.limit) : 1000;

  return {
    tableName: query.table,
    recordId: query.recordId ? parseInt(query.recordId) : null,
    userId: query.userId ? parseInt(query.userId) : null,
    action: query.action,
    startDate: query.startDate,
    endDate: query.endDate,
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT) : 1000,
    offset: query.offset ? parseInt(query.offset) : 0
  };
}

// Export audit logs (CSV/JSON) using the same filters as GET /api/audit-logs
app.get('/api/audit-logs/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token structure' });
    }
    await db.setCurrentUserId(userId);

    const format = String(req.query.format || 'csv').toLowerCase();
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use csv or json.' });
    }

    const filters = buildAuditFiltersFromQuery(req.query);
    const logs = await db.getAuditLogs(filters);

    // Log export event after fetching so the export output doesn't include itself.
    await db.logAuditEvent('audit_logs', 0, 'EXPORT', null, {
      format,
      filters,
      resultCount: Array.isArray(logs) ? logs.length : 0
    }, {
      userId,
      username: req.user?.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filenameBase = `audit-logs-${timestamp}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.json"`);
      return res.send(JSON.stringify(logs, null, 2));
    }

    // CSV
    const columns = [
      'id',
      'timestamp',
      'action',
      'table_name',
      'record_id',
      'username',
      'user_full_name',
      'user_email',
      'ip_address',
      'user_agent',
      'old_data',
      'new_data'
    ];

    const csv = toCsv(logs, columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

// Get audit logs with filters
app.get('/api/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Use userId from JWT token, fallback to id if userId not present
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      console.error('No userId found in token:', req.user);
      return res.status(401).json({ error: 'Invalid token structure' });
    }
    await db.setCurrentUserId(userId);
    
    const filters = buildAuditFiltersFromQuery(req.query);

    const logs = await db.getAuditLogs(filters);
    res.json(logs);
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get history for a specific record
app.get('/api/audit-logs/:table/:id', authenticateToken, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    
    const { table, id } = req.params;
    const history = await db.getRecordHistory(table, parseInt(id));
    res.json(history);
  } catch (error) {
    console.error('Get record history error:', error);
    res.status(500).json({ error: 'Failed to fetch record history' });
  }
});

// ===== ASSET ROUTES (Protected) =====

// Get all assets (RLS: users see only their own, admins see all)
app.get('/api/assets', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    await db.setCurrentUserId(userId);
    
    const assets = await db.getAllAssets();
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get asset by ID (RLS: users see only their own, admins see all)
app.get('/api/assets/:id', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    await db.setCurrentUserId(userId);
    
    const asset = await db.getAssetById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search assets (RLS: users see only their own, admins see all)
app.get('/api/assets/search/:query', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    await db.setCurrentUserId(userId);
    
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

// Create new asset (Admin-only)
app.post('/api/assets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.user;
    await db.setCurrentUserId(userId);
    
    // If user_id not provided in body, assign to requesting user (for admins creating for users)
    const assetData = {
      ...req.body,
      user_id: req.body.user_id || userId  // Default to current user if not specified
    };
    
    const asset = await db.createAsset(assetData);
    
    // Log audit event
    await db.logAuditEvent('assets', asset.id, 'CREATE', null, asset, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update asset (Admin-only)
app.put('/api/assets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.user;
    await db.setCurrentUserId(userId);
    
    const oldAsset = await db.getAssetById(req.params.id);
    const asset = await db.updateAsset(req.params.id, req.body);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Log audit event
    await db.logAuditEvent('assets', asset.id, 'UPDATE', oldAsset, asset, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete asset
app.delete('/api/assets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const asset = await db.deleteAsset(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Log audit event
    await db.logAuditEvent('assets', asset.id, 'DELETE', asset, null, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ message: 'Asset deleted', asset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- LICENSES ROUTES ---

// Get all licenses
app.get('/api/licenses', authenticateToken, requireAdmin, async (req, res) => {
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
app.post('/api/licenses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('📝 Creating license with data:', req.body);
    const license = await db.createLicense(req.body);
    console.log('✅ License created:', license);
    
    // Audit log
    await db.logAuditEvent('licenses', license.id, 'CREATE', null, license, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json(license);
  } catch (error) {
    console.error('❌ License creation error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Update license
app.put('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('📝 Updating license', req.params.id, 'with data:', req.body);
    
    // Get old license for audit
    const oldLicense = await db.getLicenseById(req.params.id);
    const license = await db.updateLicense(req.params.id, req.body);
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    console.log('✅ License updated:', license);
    
    // Audit log
    await db.logAuditEvent('licenses', license.id, 'UPDATE', oldLicense, license, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(license);
  } catch (error) {
    console.error('❌ License update error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Delete license
app.delete('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const license = await db.deleteLicense(req.params.id);
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    
    // Audit log
    await db.logAuditEvent('licenses', license.id, 'DELETE', license, null, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ message: 'License deleted', license });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- USERS ROUTES ---

// Get all users
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
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
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await db.createUser(req.body);
    
    // Audit log
    await db.logAuditEvent('users', user.id, 'CREATE', null, user, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update user
app.put('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get old user for audit
    const oldUser = await db.getUserById(req.params.id);
    const user = await db.updateUser(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Audit log
    await db.logAuditEvent('users', user.id, 'UPDATE', oldUser, user, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete user
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await db.deleteUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Audit log
    await db.logAuditEvent('users', user.id, 'DELETE', user, null, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ message: 'User deleted', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CONTRACTS ROUTES ---

// Get all contracts
app.get('/api/contracts', authenticateToken, requireAdmin, async (req, res) => {
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
app.post('/api/contracts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const contract = await db.createContract(req.body);
    
    // Audit log
    await db.logAuditEvent('contracts', contract.id, 'CREATE', null, contract, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json(contract);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update contract
app.put('/api/contracts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get old contract for audit
    const oldContract = await db.getContractById(req.params.id);
    const contract = await db.updateContract(req.params.id, req.body);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Audit log
    await db.logAuditEvent('contracts', contract.id, 'UPDATE', oldContract, contract, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(contract);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete contract
app.delete('/api/contracts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const contract = await db.deleteContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Audit log
    await db.logAuditEvent('contracts', contract.id, 'DELETE', contract, null, {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ message: 'Contract deleted', contract });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== DIGITAL RECEIPTS ROUTES =====

// Upload receipt for an asset
app.post('/api/assets/:id/receipts', authenticateToken, requireAdmin, upload.single('receipt'), async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const assetId = parseInt(req.params.id);
    const receipt = await db.createReceipt(assetId, {
      file_name: req.file.originalname,
      file_path: `/uploads/receipts/${req.file.filename}`,
      file_size: req.file.size,
      file_type: req.file.mimetype,
      description: req.body.description || null,
      uploaded_by: req.user.userId,
      uploaded_by_name: req.user.username,
      user_id: req.user.userId
    });

    res.status(201).json(receipt);
  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// Get all receipts for an asset
app.get('/api/assets/:id/receipts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    
    const assetId = parseInt(req.params.id);
    const receipts = await db.getReceiptsByAssetId(assetId);
    res.json(receipts);
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// Delete a receipt
app.delete('/api/receipts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    
    const receipt = await db.deleteReceipt(req.params.id);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, receipt.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'Receipt deleted', receipt });
  } catch (error) {
    console.error('Delete receipt error:', error);
    res.status(500).json({ error: 'Failed to delete receipt' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== AGENT ROUTES =====

// Receive usage data from agent
app.post('/api/agent/usage', authenticateToken, async (req, res) => {
  try {
    const { device_id, app_name, window_title, duration, timestamp } = req.body;
    const { userId } = req.user; // Get from JWT token (secure)
    
    if (!device_id || !app_name) {
      return res.status(400).json({ error: 'device_id and app_name are required' });
    }

    // Set PostgreSQL session variable for Row-Level Security
    await db.setCurrentUserId(userId);

    // Ensure device exists first (auto-create if needed)
    await db.upsertDevice({
      device_id,
      user_id: userId, // Associate device with user
      hostname: device_id,
      os_name: 'Unknown',
      os_version: 'Unknown',
      timestamp: Date.now()
    });

    const usageData = await db.insertUsageData({
      device_id,
      user_id: userId, // Associate usage with user
      app_name,
      window_title: window_title || '',
      duration: duration || 0,
      timestamp: timestamp || Date.now()
    });

    res.status(201).json({ 
      message: 'Usage data recorded',
      data: usageData
    });
  } catch (error) {
    console.error('Error recording usage data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Receive heartbeat from agent
app.post('/api/agent/heartbeat', authenticateToken, async (req, res) => {
  try {
    const { device_id, timestamp, hostname, os_name, os_version } = req.body;
    const { userId } = req.user; // From JWT
    
    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    // Set PostgreSQL session variable for Row-Level Security
    await db.setCurrentUserId(userId);

    // Update or create device
    await db.upsertDevice({
      device_id,
      hostname,
      os_name,
      os_version,
      user_id: userId
    });

    // Record heartbeat
    await db.insertHeartbeat({
      device_id,
      timestamp: timestamp || Date.now()
    });

    res.json({ 
      message: 'Heartbeat received',
      device_id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error recording heartbeat:', error);
    res.status(500).json({ error: error.message });
  }
});

// Receive installed apps list from agent
app.post('/api/agent/apps', authenticateToken, async (req, res) => {
  try {
    const { device_id, apps } = req.body;
    
    if (!device_id || !Array.isArray(apps)) {
      return res.status(400).json({ error: 'device_id and apps array are required' });
    }

    await db.upsertInstalledApps(device_id, apps);

    res.json({ 
      message: 'Installed apps updated',
      count: apps.length
    });
  } catch (error) {
    console.error('Error updating installed apps:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get device usage statistics
app.get('/api/agent/devices', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.user; // From JWT
    
    // Set PostgreSQL session variable for Row-Level Security
    await db.setCurrentUserId(userId);
    
    // Row-Level Security will automatically filter based on user
    // Admins see all, regular users see only theirs
    const devices = await db.getAllDevices();
    
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific device usage stats
app.get('/api/agent/devices/:deviceId/usage', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startDate, endDate } = req.query;
    const { userId } = req.user; // From JWT
    
    // Set PostgreSQL session variable for Row-Level Security
    await db.setCurrentUserId(userId);
    
    // Row-Level Security will automatically filter - users can only see their own device usage
    const usage = await db.getDeviceUsageStats(deviceId, startDate, endDate);
    res.json(usage);
  } catch (error) {
    console.error('Error fetching device usage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get app usage summary across all devices
app.get('/api/agent/apps/usage', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { userId } = req.user; // From JWT
    
    // Set PostgreSQL session variable for Row-Level Security
    await db.setCurrentUserId(userId);
    
    // Row-Level Security will automatically filter - users see only their devices' apps
    const appUsage = await db.getAppUsageSummary(startDate, endDate);
    res.json(appUsage);
  } catch (error) {
    console.error('Error fetching app usage:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== FORBIDDEN APPS & SECURITY ALERTS ROUTES =====

/**
 * Forbidden Apps
 *
 * Routes:
 * - GET    /api/forbidden-apps        (auth) list all forbidden apps (used by UI + agent sync)
 * - GET    /api/forbidden-apps/list   (auth) lightweight list for agent sync (process_name, severity)
 * - POST   /api/forbidden-apps        (admin) create forbidden app
 * - PUT    /api/forbidden-apps/:id    (admin) update forbidden app
 * - DELETE /api/forbidden-apps/:id    (admin) delete forbidden app
 *
 * Security model:
 * - All routes require JWT (`authenticateToken`).
 * - Write routes require `role === 'admin'`.
 * - For multi-tenancy/RLS, we call `db.setCurrentUserId(userId)` before DB work.
 *
 * Compliance/audit:
 * - POST/PUT/DELETE write an audit record into `audit_logs` via `db.logAuditEvent()`.
 * - Actions are constrained by DB schema to: LOGIN/LOGOUT/CREATE/UPDATE/DELETE/EXPORT.
 * - Audit payload includes actor (userId/username) and request metadata (ip/user-agent).
 */

// Get all forbidden apps (for agent sync)
app.get('/api/forbidden-apps', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    await db.setCurrentUserId(userId);
    
    const forbiddenApps = await db.getAllForbiddenApps();
    res.json(forbiddenApps);
  } catch (error) {
    console.error('Error fetching forbidden apps:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get forbidden apps list (lightweight for agent sync)
app.get('/api/forbidden-apps/list', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    await db.setCurrentUserId(userId);
    
    const list = await db.getForbiddenAppsList();
    res.json(list);
  } catch (error) {
    console.error('Error fetching forbidden apps list:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create forbidden app (admin only)
app.post('/api/forbidden-apps', [
  authenticateToken,
  body('process_name').trim().notEmpty().withMessage('Process name is required'),
  body('severity').optional().isIn(['Low', 'Medium', 'High', 'Critical']).withMessage('Invalid severity level')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { userId, role } = req.user;
    const actorUserId = req.user?.userId || req.user?.id;
    const actorUsername = req.user?.username;
    
    // Check if user is admin
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await db.setCurrentUserId(userId);
    
    const appData = {
      process_name: req.body.process_name,
      description: req.body.description,
      severity: req.body.severity || 'Medium',
      created_by: userId
    };
    
    const newApp = await db.createForbiddenApp(appData);

    await db.logAuditEvent('forbidden_apps', newApp.id, 'CREATE', null, newApp, {
      userId: actorUserId,
      username: actorUsername,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json(newApp);
  } catch (error) {
    console.error('Error creating forbidden app:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update forbidden app (admin only)
app.put('/api/forbidden-apps/:id', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const actorUserId = req.user?.userId || req.user?.id;
    const actorUsername = req.user?.username;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await db.setCurrentUserId(userId);
    
    const { id } = req.params;
    const oldApp = await db.getForbiddenAppById(parseInt(id));
    const updatedApp = await db.updateForbiddenApp(id, req.body);
    
    if (!updatedApp) {
      return res.status(404).json({ error: 'Forbidden app not found' });
    }

    await db.logAuditEvent('forbidden_apps', updatedApp.id, 'UPDATE', oldApp || null, updatedApp, {
      userId: actorUserId,
      username: actorUsername,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json(updatedApp);
  } catch (error) {
    console.error('Error updating forbidden app:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete forbidden app (admin only)
app.delete('/api/forbidden-apps/:id', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const actorUserId = req.user?.userId || req.user?.id;
    const actorUsername = req.user?.username;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await db.setCurrentUserId(userId);
    
    const { id } = req.params;
    const oldApp = await db.getForbiddenAppById(parseInt(id));
    const deleted = await db.deleteForbiddenApp(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Forbidden app not found' });
    }

    await db.logAuditEvent('forbidden_apps', deleted.id, 'DELETE', oldApp || deleted, null, {
      userId: actorUserId,
      username: actorUsername,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({ message: 'Forbidden app deleted successfully', deleted });
  } catch (error) {
    console.error('Error deleting forbidden app:', error);
    res.status(500).json({ error: error.message });
  }
});

// Report security alert (from agent)
app.post('/api/alerts', [
  authenticateToken,
  body('device_id').notEmpty().withMessage('device_id is required'),
  body('app_detected').notEmpty().withMessage('app_detected is required'),
  body('severity').optional().isIn(['Low', 'Medium', 'High', 'Critical'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { userId } = req.user;
    await db.setCurrentUserId(userId);
    
    const alertData = {
      device_id: req.body.device_id,
      app_detected: req.body.app_detected,
      severity: req.body.severity || 'Medium',
      process_id: req.body.process_id,
      user_id: userId
    };
    
    const alert = await db.createSecurityAlert(alertData);
    
    // Note: PostgreSQL trigger will automatically broadcast via WebSocket
    console.log('🚨 Security alert created:', alert);
    
    res.status(201).json(alert);
  } catch (error) {
    console.error('Error creating security alert:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all security alerts
app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    await db.setCurrentUserId(userId);
    
    const { limit, status } = req.query;
    const alerts = await db.getAllSecurityAlerts(
      limit ? parseInt(limit) : 100,
      status || null
    );
    
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get alert statistics
app.get('/api/alerts/stats', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    await db.setCurrentUserId(userId);
    
    const stats = await db.getAlertStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update alert status (admin only)
app.patch('/api/alerts/:id', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await db.setCurrentUserId(userId);
    
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const updated = await db.updateAlertStatus(id, status, userId, notes);
    
    if (!updated) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get alerts for specific device
app.get('/api/alerts/device/:deviceId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    await db.setCurrentUserId(userId);
    
    const { deviceId } = req.params;
    const { limit } = req.query;
    
    const alerts = await db.getDeviceAlerts(deviceId, limit ? parseInt(limit) : 50);
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching device alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize and start server
startServer();

// Global error handler (must be after routes)
// Ensures unexpected errors return JSON and include request correlation id.
app.use((err, req, res, next) => {
  const requestId = req?.requestId || 'unknown';
  console.error(`[${new Date().toISOString()}] [${requestId}] Unhandled error:`, err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: 'Internal server error',
    requestId
  });
});

// Export for Vercel
export default app;

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await shutdownAlertService();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await shutdownAlertService();
  process.exit(0);
});

// Start listening (both production and development)
httpServer.listen(PORT, () => {
  console.log(`\n🚀 IT Asset Tracker Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket ready for real-time alerts\n`);
});
