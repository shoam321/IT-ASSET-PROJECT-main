import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
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
import axios from 'axios';
import pool, { dbAsyncLocalStorage } from './db.js';
import * as db from './queries.js';
import * as authQueries from './authQueries.js';
import * as consumablesDb from './consumablesQueries.js';
import { authenticateToken, generateToken, requireAdmin, authorize } from './middleware/auth.js';
import { initializeAlertService, shutdownAlertService } from './alertService.js';
import { getCached, invalidateCache, getRedisClient } from './redis.js';
import * as emailService from './emailService.js';
import { startLicenseExpirationChecker, stopLicenseExpirationChecker } from './licenseExpirationChecker.js';
import { createOrder as createPayPalOrder, captureOrder as capturePayPalOrder, getOrder as getPayPalOrder, verifyWebhookSignature, allowedCurrencies as paypalCurrencies } from './paypalClient.js';
import { getSubscription as getPayPalSubscription } from './paypalSubscriptions.js';
import { startHealthCheckScheduler, stopHealthCheckScheduler, runHealthCheckAndNotify } from './healthCheckService.js';
import metrics, { metricsMiddleware, updateBusinessMetrics, updatePoolMetrics, getMetrics, getMetricsContentType, authAttempts, subscriptionEvents, websocketConnections, alertsGenerated, cacheOperations, cacheLatency } from './metrics.js';
import { setupCrashHandlers, recordStartup, recordError, getCrashStats, getCrashLogsFromDb, getStartupLogsFromDb } from './crashDetectionService.js';

// Initialize crash detection FIRST before anything else
setupCrashHandlers();
recordStartup();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables relative to this folder so `node itam-saas/Agent/server.js`
// works no matter what the current working directory is.
// Prefer `.env.local` for local development to avoid accidentally using production creds.
// In production (Railway), env vars are set directly - don't load .env files
if (process.env.NODE_ENV !== 'production') {
  const envLocalPath = path.join(__dirname, '.env.local');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
  } else if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

const parseAllowedOrigins = () => {
  const sources = [process.env.FRONTEND_URL, process.env.REACT_APP_URL].filter(Boolean);
  const parsed = sources
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  // Defaults are intentionally minimal; Vercel preview deployments are allowed via suffix check.
  if (parsed.length) return Array.from(new Set(parsed));
  return [
    'https://it-asset-project.vercel.app',
    'https://it-asset-project-git-main-shoams-projects-578cf60a.vercel.app'
  ];
};

// Production-safe error response helper
const safeError = (error, fallbackMessage = 'Internal server error') => {
  if (process.env.NODE_ENV === 'production') {
    // Never expose internal error details in production
    return { error: fallbackMessage };
  }
  // Development: show full error for debugging
  return { error: error?.message || fallbackMessage, stack: error?.stack };
};

// Startup diagnostics (do not print secrets)
console.log('🔧 Environment:', {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT,
  HAS_DATABASE_URL: Boolean(process.env.DATABASE_URL),
  HAS_JWT_SECRET: Boolean(process.env.JWT_SECRET),
  HAS_SESSION_SECRET: Boolean(process.env.SESSION_SECRET)
});

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET', 'GOOGLE_CLIENT_SECRET'];
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('❌ FATAL: Missing required environment variables:', missing.join(', '));
    console.error('   Set these in Railway dashboard before deployment');
    process.exit(1);
  }
  console.log('✅ All required environment variables present');
}

try {
  if (process.env.DATABASE_URL) {
    const dbUrl = new URL(process.env.DATABASE_URL);
    console.log('🔧 Database target:', {
      host: dbUrl.hostname,
      port: dbUrl.port || '(default)',
      database: dbUrl.pathname?.replace('/', '') || '(unknown)'
    });

    const isLocalDbHost = dbUrl.hostname === 'localhost' || dbUrl.hostname === '127.0.0.1';
    const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    if (!isProd && !isLocalDbHost) {
      console.warn('⚠️ Warning: running in non-production while DATABASE_URL points to a non-local host. Consider using itam-saas/Agent/.env.local for a local dev DB.');
    }
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

// ===== Billing (company-level) =====
const normalizePayPalSubscriptionStatus = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ACTIVE') return 'active';
  if (normalized === 'APPROVAL_PENDING') return 'approval_pending';
  if (normalized === 'APPROVED') return 'approved';
  if (normalized === 'SUSPENDED') return 'suspended';
  if (normalized === 'CANCELLED') return 'canceled';
  if (normalized === 'EXPIRED') return 'expired';
  return normalized ? normalized.toLowerCase() : 'unknown';
};

// Socket.IO configuration
const io = new Server(httpServer, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const allowedOrigins = parseAllowedOrigins();
      
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
  websocketConnections.inc();
  
  socket.on('disconnect', () => {
    console.log('🔌 WebSocket client disconnected:', socket.id);
    websocketConnections.dec();
  });
});

// Rate limiting (tunable via env to avoid 429s behind shared proxies)
const AUTH_RATE_LIMIT_WINDOW_MS = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);
const AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10);

const PAYMENT_RATE_LIMIT_WINDOW_MS = parseInt(process.env.PAYMENT_RATE_LIMIT_WINDOW_MS || `${60 * 60 * 1000}`, 10);
const PAYMENT_RATE_LIMIT_MAX = parseInt(process.env.PAYMENT_RATE_LIMIT_MAX || '100', 10);

const API_RATE_LIMIT_WINDOW_MS = parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);
const API_RATE_LIMIT_MAX = parseInt(process.env.API_RATE_LIMIT_MAX || '2000', 10);
const API_RATE_LIMIT_ENABLED = process.env.API_RATE_LIMIT_ENABLED !== 'false';

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
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

const paymentLimiter = rateLimit({
  windowMs: PAYMENT_RATE_LIMIT_WINDOW_MS,
  max: PAYMENT_RATE_LIMIT_MAX,
  message: 'Too many payment requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Payment rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many payment requests. Please try again in an hour.'
    });
  }
});

const apiLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: () => !API_RATE_LIMIT_ENABLED
});

// Security headers with Helmet.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.paypal.com", "https://www.paypal.com"],
      frameSrc: ["'self'", "https://www.paypal.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const allowedOrigins = parseAllowedOrigins();
const ALLOWED_VERCEL_DOMAINS = [
  'it-asset-project.vercel.app',
  'it-asset-project-git-main-shoams-projects-578cf60a.vercel.app'
];
console.log('🔧 CORS Origins:', allowedOrigins);
console.log('🔧 Allowed Vercel Domains:', ALLOWED_VERCEL_DOMAINS);

// Trust Railway proxy for proper IP forwarding
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is in explicit allowlist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check if origin is an allowed Vercel domain
    try {
      const originHost = new URL(origin).hostname;
      if (ALLOWED_VERCEL_DOMAINS.includes(originHost)) {
        return callback(null, true);
      }
    } catch (e) {
      // Invalid origin URL
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

// Ensure allowed origins always receive the CORS headers (including error responses)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();
  
  let allowed = allowedOrigins.includes(origin);
  if (!allowed) {
    try {
      const originHost = new URL(origin).hostname;
      allowed = ALLOWED_VERCEL_DOMAINS.includes(originHost);
    } catch (e) {
      // Invalid origin
    }
  }
  
  if (allowed) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  }
  next();
});

// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter);

// Explicitly handle OPTIONS requests for all routes
app.options('*', cors());
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({ extended: true }));

// Prometheus metrics middleware - track all requests
app.use(metricsMiddleware);

// Prometheus metrics endpoint - must be BEFORE authentication
app.get('/metrics', async (req, res) => {
  try {
    // Update pool metrics on each scrape
    updatePoolMetrics(pool);
    
    res.set('Content-Type', getMetricsContentType());
    res.end(await getMetrics());
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).end('Error generating metrics');
  }
});

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

  // Use enterWith() (more reliable with Express) so all downstream async work
  // for this request sees the same store/client.
  dbAsyncLocalStorage.enterWith({ client });
  next();
});

// Trust proxy for secure cookies behind Railway/Vercel/NGINX
app.set('trust proxy', 1);

// Prefer a production-backed session store when available; fallback to MemoryStore
let sessionStore;
try {
  if (process.env.USE_PG_SESSION === 'true') {
    // Dynamically import to avoid hard dependency when not needed
    const mod = await import('connect-pg-simple');
    const PgSession = mod.default(session);
    sessionStore = new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'user_sessions',
      createTableIfMissing: true
    });
    console.log('🔐 Session store: connect-pg-simple');
  }
} catch (e) {
  console.warn('⚠️ Failed to initialize connect-pg-simple. Falling back to MemoryStore.', e?.message);
}
if (!sessionStore) {
  sessionStore = new session.MemoryStore();
  console.warn('⚠️ Using MemoryStore. Not suitable for production.');
}

// Session configuration for Passport
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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

const FRONTEND_BASE_URL = process.env.FRONTEND_URL || 'https://it-asset-project.vercel.app';
const paypalCurrencySet = new Set((paypalCurrencies || []).map(c => c.toUpperCase()));

const parseAllowedGrafanaHosts = () => {
  const raw = process.env.GRAFANA_ALLOWED_HOSTS || '';
  // Default allowed hosts for Railway Grafana deployments
  const defaultHosts = ['railway.app', 'grafana.com', 'grafana.net'];
  const parsed = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => {
      try {
        return new URL(v).hostname.toLowerCase();
      } catch {
        return v.toLowerCase();
      }
    });
  // Combine user-configured hosts with defaults
  return [...new Set([...parsed, ...defaultHosts])];
};

const isAllowedGrafanaUrl = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowed = parseAllowedGrafanaHosts();
    if (!allowed.length) return true;
    return allowed.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

// Ensure multi-tenant org schema exists (idempotent). Uses DATABASE_OWNER_URL when available.
let _ensureOrgSchemaRan = false;
async function ensureOrgSchema() {
  if (_ensureOrgSchemaRan) return;

  // Fast path: check if required tables/columns already exist to avoid permission errors
  try {
    const check = await pool.query(`
      SELECT
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') AS has_organizations,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'organization_id') AS has_org_id,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'org_role') AS has_org_role,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'billing_tier') AS has_billing_tier
    `);
    const row = check.rows[0] || {};
    if (row.has_organizations && row.has_org_id && row.has_org_role && row.has_billing_tier) {
      console.log('✅ Organization schema already exists, skipping creation');
      _ensureOrgSchemaRan = true;
      return;
    }
  } catch (e) {
    console.log('Schema check failed, attempting creation:', e.message);
  }

  // Lazy-load pg here to avoid import cycles.
  const { Pool } = await import('pg');
  const ownerDsn = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;
  if (!ownerDsn) throw new Error('DATABASE_URL not configured');

  const ownerPool = new Pool({ connectionString: ownerDsn, ssl: ownerDsn.includes('railway') ? { rejectUnauthorized: false } : false });
  const client = await ownerPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        plan VARCHAR(50) DEFAULT 'free',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(
      `ALTER TABLE organizations
         ADD COLUMN IF NOT EXISTS billing_tier VARCHAR(50) DEFAULT 'regular',
         ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50),
         ADD COLUMN IF NOT EXISTS paypal_subscription_id VARCHAR(255),
         ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP,
         ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP,
         ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMP`);

    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain) WHERE domain IS NOT NULL`
    );

    await client.query(
      `ALTER TABLE auth_users
       ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)`
    );

    await client.query(
      `ALTER TABLE auth_users
       ADD COLUMN IF NOT EXISTS org_role VARCHAR(50) DEFAULT 'member'`
    );

    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_auth_users_organization_id ON auth_users(organization_id)'
    );

    // ===== Enable RLS and create policies =====
    
    // Enable RLS on organizations table
    await client.query('ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;');

    // SELECT policy - users can see orgs they belong to
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'organizations' AND policyname = 'organizations_select_policy'
        ) THEN
          CREATE POLICY organizations_select_policy ON organizations
            FOR SELECT
            USING (
              id IN (
                SELECT organization_id FROM auth_users 
                WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
              )
            );
        END IF;
      END $$;
    `);

    // UPDATE policy - only admins/owners can update
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'organizations' AND policyname = 'organizations_update_policy'
        ) THEN
          CREATE POLICY organizations_update_policy ON organizations
            FOR UPDATE
            USING (
              id IN (
                SELECT organization_id FROM auth_users 
                WHERE id = current_setting('app.current_user_id', TRUE)::INTEGER
                AND org_role IN ('owner', 'admin')
              )
            );
        END IF;
      END $$;
    `);

    // INSERT policy - allows system context (app.system='1') to create organizations
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'organizations' AND policyname = 'organizations_insert_policy'
        ) THEN
          CREATE POLICY organizations_insert_policy ON organizations
            FOR INSERT
            WITH CHECK (current_setting('app.system', TRUE)::TEXT = '1');
        END IF;
      END $$;
    `);

    _ensureOrgSchemaRan = true;
  } catch (e) {
    console.error('❌ Failed to create org schema (permission denied?), continuing anyway:', e.message);
    _ensureOrgSchemaRan = true; // Mark as ran to prevent repeated failures
  } finally {
    client.release();
    await ownerPool.end();
  }
}

// Ensure onboarding foundation tables/columns exist (idempotent, owner DSN when available)
let _ensureOnboardingFoundationRan = false;
async function ensureOnboardingFoundationSchema() {
  if (_ensureOnboardingFoundationRan) return;
  const { Pool } = await import('pg');
  // Fast path: if the schema is already present, skip owner operations (avoid permission errors on app DSN)
  const appClient = await pool.connect();
  try {
    const check = await appClient.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'auth_users' AND column_name = 'onboarding_completed'
        ) AS has_onboarding_completed,
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'locations') AS has_locations,
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') AS has_employees,
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'asset_categories') AS has_asset_categories,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'location_id') AS has_assets_location_id,
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assets' AND column_name = 'category_id') AS has_assets_category_id
    `);
    const row = check.rows[0] || {};
    if (row.has_onboarding_completed && row.has_locations && row.has_employees && row.has_asset_categories && row.has_assets_location_id && row.has_assets_category_id) {
      console.log('✅ Onboarding foundation schema already exists, skipping creation');
      _ensureOnboardingFoundationRan = true;
      return;
    }
    console.log('Onboarding foundation schema check:', row);
  } finally {
    appClient.release();
  }

  const ownerDsn = process.env.DATABASE_OWNER_URL;
  if (!ownerDsn) {
    console.log('⚠️ Onboarding schema missing and DATABASE_OWNER_URL not set. Some tables may need manual creation.');
    _ensureOnboardingFoundationRan = true; // Mark as ran to prevent repeated failures
    return;
  }

  const ownerPool = new Pool({ connectionString: ownerDsn, ssl: ownerDsn.includes('railway') ? { rejectUnauthorized: false } : false });
  const client = await ownerPool.connect();
  try {
    await client.query('BEGIN');

    const trialStartedAt = new Date();
    const trialEndsAt = new Date(trialStartedAt.getTime());
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    // auth_users.onboarding_completed
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'auth_users' AND column_name = 'onboarding_completed'
        ) THEN
          ALTER TABLE auth_users ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
        END IF;
      END$$;
    `);

    // Locations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_org_default ON locations(organization_id) WHERE is_default;
    `);

    // Employees (ghost users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        department VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_org_email ON employees(organization_id, email) WHERE email IS NOT NULL;
    `);

    // Asset categories (with icon_name for frontend icons)
    await client.query(`
      CREATE TABLE IF NOT EXISTS asset_categories (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        icon_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (organization_id, slug)
      );
      CREATE INDEX IF NOT EXISTS idx_asset_categories_org ON asset_categories(organization_id);
    `);

    // Optional FK hooks on assets (compatible with legacy schema)
    await client.query(`
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS location_id INTEGER;
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS category_id INTEGER;
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS location VARCHAR(255);
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS assigned_to INTEGER;
      ALTER TABLE assets ADD COLUMN IF NOT EXISTS organization_id INTEGER;
      ALTER TABLE assets ADD CONSTRAINT IF NOT EXISTS fk_assets_location_id FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
      ALTER TABLE assets ADD CONSTRAINT IF NOT EXISTS fk_assets_category_id FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE SET NULL;
      ALTER TABLE assets ADD CONSTRAINT IF NOT EXISTS fk_assets_org_id FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_assets_org_id ON assets(organization_id);
    `);

    // Best-effort backfill: attach existing assets to their owner's organization when possible
    await client.query(`
      UPDATE assets a
         SET organization_id = u.organization_id
        FROM auth_users u
       WHERE a.organization_id IS NULL
         AND a.user_id = u.id
         AND u.organization_id IS NOT NULL;
    `);

    await client.query('COMMIT');
    console.log('✅ Onboarding foundation schema created successfully');
    _ensureOnboardingFoundationRan = true;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to ensure onboarding foundation schema (permission denied?):', e.message);
    _ensureOnboardingFoundationRan = true; // Mark as ran to prevent repeated failures
  } finally {
    client.release();
    await ownerPool.end();
  }
}

// Ensure Grafana dashboards table exists (idempotent, owner DSN preferred)
let _ensureGrafanaDashboardsRan = false;
async function ensureGrafanaDashboardsSchema() {
  if (_ensureGrafanaDashboardsRan) return;

  // Check if table exists first using regular pool
  try {
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'grafana_dashboards'
      );
    `);
    if (checkResult.rows[0].exists) {
      console.log('✅ grafana_dashboards table already exists, skipping creation');
      _ensureGrafanaDashboardsRan = true;
      return;
    }
  } catch (e) {
    console.log('Check for grafana_dashboards failed:', e.message);
  }

  // Only attempt creation if table doesn't exist
  const { Pool } = await import('pg');
  const ownerDsn = process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL;
  if (!ownerDsn) {
    console.log('⚠️ DATABASE_URL not configured, grafana_dashboards table may need manual creation');
    _ensureGrafanaDashboardsRan = true;
    return;
  }

  const ownerPool = new Pool({ connectionString: ownerDsn, ssl: ownerDsn.includes('railway') ? { rejectUnauthorized: false } : false });
  const client = await ownerPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS grafana_dashboards (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        embed_url TEXT NOT NULL,
        created_by INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_grafana_dashboards_org ON grafana_dashboards(organization_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_grafana_dashboards_org_name ON grafana_dashboards(organization_id, name);
    `);
    console.log('✅ grafana_dashboards table created successfully');
    _ensureGrafanaDashboardsRan = true;
  } catch (e) {
    console.error('❌ Failed to create grafana_dashboards table (permission denied?):', e.message);
    _ensureGrafanaDashboardsRan = true; // Mark as ran to prevent repeated failures
  } finally {
    client.release();
    await ownerPool.end();
  }
}

function toCents(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Math.round(num * 100);
}

function centsToValue(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

// Initialize database on startup
async function startServer() {
  let retries = 5;
  while (retries > 0) {
    try {
      console.log(`🔄 Attempting to initialize database (${6 - retries}/5)...`);
      await db.initDatabase();
      console.log('✅ Database initialized successfully');

      try {
        await ensureOrgSchema();
      } catch (schemaError) {
        console.error('❌ Failed to ensure org schema:', schemaError.message);
        console.error('ℹ️ If this is a permission issue, run itam-saas/Agent/run-org-migration.js with DATABASE_OWNER_URL set to a schema owner.');
        // Do not rethrow; continue startup so existing endpoints remain available.
      }
      
      // Ensure organization_id column exists on assets table
      try {
        const pgPool = db.getPool();
        await pgPool.query('ALTER TABLE assets ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)');
        console.log('✅ Assets table has organization_id column');
        // Clear any cached column checks so they re-detect
        db.clearColumnCache && db.clearColumnCache();
      } catch (colError) {
        console.error('⚠️ Failed to add organization_id to assets:', colError.message);
      }
      
      // Disable RLS on assets/licenses tables - security enforced at application level
      try {
        const pgPool = db.getPool();
        await pgPool.query('ALTER TABLE assets DISABLE ROW LEVEL SECURITY');
        await pgPool.query('ALTER TABLE licenses DISABLE ROW LEVEL SECURITY');
        console.log('✅ RLS disabled on assets/licenses (security at app level)');
      } catch (rlsError) {
        console.error('⚠️ Failed to disable RLS:', rlsError.message);
      }
      
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
      
      // Start license expiration checker
      try {
        global.licenseCheckerInterval = startLicenseExpirationChecker();
      } catch (error) {
        console.error('⚠️ Failed to start license expiration checker:', error.message);
      }
      
      // Start 24-hour health check scheduler
      try {
        startHealthCheckScheduler();
        console.log('✅ Health check scheduler started (24-hour interval)');
      } catch (error) {
        console.error('⚠️ Failed to start health check scheduler:', error.message);
      }
      
      // Start Prometheus business metrics collector (every 5 minutes)
      try {
        const METRICS_INTERVAL = 5 * 60 * 1000; // 5 minutes
        // Initial update
        await updateBusinessMetrics(pool);
        // Schedule periodic updates
        global.metricsInterval = setInterval(async () => {
          try {
            await updateBusinessMetrics(pool);
          } catch (err) {
            console.error('⚠️ Metrics update failed:', err.message);
          }
        }, METRICS_INTERVAL);
        console.log('✅ Prometheus metrics collector started (5-min interval)');
        console.log('📊 Metrics endpoint: /metrics');
      } catch (error) {
        console.error('⚠️ Failed to start metrics collector:', error.message);
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
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || 'unknown',
    dbUrlSet: !!process.env.DATABASE_URL,
    dbUrlPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'NOT SET'
  });
});

// Legal documents
app.get('/api/legal/privacy-policy', (req, res) => {
  const filePath = path.join(__dirname, 'legal', 'privacy-policy.md');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Privacy Policy not found' });
  }
  const content = fs.readFileSync(filePath, 'utf8');
  res.set('Content-Type', 'text/markdown; charset=utf-8');
  res.send(content);
});

app.get('/api/legal/terms-of-service', (req, res) => {
  const filePath = path.join(__dirname, 'legal', 'terms-of-service.md');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Terms of Service not found' });
  }
  const content = fs.readFileSync(filePath, 'utf8');
  res.set('Content-Type', 'text/markdown; charset=utf-8');
  res.send(content);
});

// Comprehensive health check with email notification (Admin-only)
app.post('/api/health/check', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🏥 Manual health check triggered by admin');
    const report = await runHealthCheckAndNotify();
    res.json({
      message: 'Health check completed and email sent',
      report
    });
  } catch (error) {
    console.error('❌ Manual health check failed:', error);
    res.status(500).json({ error: 'Health check failed', details: error.message });
  }
});

// Get health check status without sending email (Admin-only)
app.get('/api/health/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { runHealthChecks } = await import('./healthCheckService.js');
    const report = await runHealthChecks();
    res.json(report);
  } catch (error) {
    console.error('❌ Health status check failed:', error);
    res.status(500).json({ error: 'Health check failed', details: error.message });
  }
});

// Clear column cache (Admin-only) - useful after schema changes
app.post('/api/admin/clear-cache', authenticateToken, requireAdmin, async (req, res) => {
  try {
    db.clearColumnCache && db.clearColumnCache();
    // Also clear Redis cache
    const redis = await getRedisClient();
    if (redis) {
      await redis.flushDb();
      console.log('🗑️ Redis cache flushed');
    }
    console.log('🔄 Column cache cleared by admin');
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('❌ Cache clear failed:', error);
    res.status(500).json({ error: 'Failed to clear cache', details: error.message });
  }
});

// ===== CRASH DETECTION API =====

// Get crash statistics (Admin-only)
app.get('/api/admin/crash-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = getCrashStats();
    const crashLogs = await getCrashLogsFromDb(20);
    const startupLogs = await getStartupLogsFromDb(50);
    
    res.json({
      current: stats,
      crashLogs,
      startupLogs
    });
  } catch (error) {
    console.error('❌ Failed to get crash stats:', error);
    res.status(500).json({ error: 'Failed to get crash stats', details: error.message });
  }
});

// Manually trigger a test crash alert (Admin-only, for testing)
app.post('/api/admin/test-crash-alert', authenticateToken, requireAdmin, async (req, res) => {
  try {
    recordError(new Error('Test crash alert - triggered manually'), { type: 'test' });
    res.json({ message: 'Test error recorded. If thresholds are met, an alert will be sent.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record test error', details: error.message });
  }
});

// ===== AUTHENTICATION ROUTES =====

// Register new user
app.post('/api/auth/register', authLimiter, [
  body('username').trim().isLength({ min: 3, max: 100 }).withMessage('Username must be 3-100 characters'),
  body('email').trim().isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fullName').optional().trim(),
  body('firstName').optional().trim(),
  body('lastName').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, email, password, fullName, firstName, lastName } = req.body;
    
    // Build full name from firstName + lastName if fullName not provided
    const computedFullName = fullName || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null);

    // All new users get admin role for full features
    const user = await authQueries.createAuthUser(username, email, password, computedFullName, 'admin', null, 'owner', firstName, lastName);
    const token = generateToken(user);

    // Send welcome email (non-blocking)
    emailService.sendWelcomeEmail(email, firstName || username || computedFullName).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        trialStartedAt: user.trial_started_at,
        trialEndsAt: user.trial_ends_at,
        onboarding_completed: user.onboarding_completed
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

// Check if email exists (for signup validation)
app.get('/api/auth/check-email', authLimiter, async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await authQueries.findUserByEmail(email);
    res.json({ exists: !!user });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ error: 'Failed to check email' });
  }
});

// Complete Onboarding
app.post('/api/auth/complete-onboarding', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE auth_users SET onboarding_completed = true WHERE id = $1',
      [req.user.id]
    );
    res.json({ message: 'Onboarding completed successfully' });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
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

    // Set RLS context for audit logging and downstream requests
    await db.setCurrentUserId(user.id);

    const token = generateToken(user);
    
    // Track successful login
    authAttempts.inc({ method: 'password', result: 'success' });
    
    // Log audit event
    await db.logAuditEvent('users', user.id, 'LOGIN', null, { logged_in: true }, {
      userId: user.id,
      username: user.username,
      organizationId: user.organization_id || null,
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
        role: user.role,
        organization_id: user.organization_id,
        org_role: user.org_role,
        onboarding_completed: user.onboarding_completed,
        trialStartedAt: user.trial_started_at,
        trialEndsAt: user.trial_ends_at,
        trial_started_at: user.trial_started_at,
        trial_ends_at: user.trial_ends_at
      }
    });
  } catch (error) {
    // Track failed login
    authAttempts.inc({ method: 'password', result: 'failure' });
    
    console.error('Login error:', error.message);
    if (error.message === 'Invalid username or password' || error.message === 'Account is disabled') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

// Google OAuth Routes
// NOTE: We use the OAuth `state` parameter to detect agent auth flows.
// Relying on server session cookies is flaky in cross-site redirects.
app.get('/api/auth/google', (req, res, next) => {
  const isAgent = req.query.agent === 'true';
  const agentPort = req.query.port;
  const agentNonce = req.query.nonce;
  const options = { scope: ['profile', 'email'] };
  if (isAgent) {
    // Encode callback details in OAuth state so it survives the Google redirect.
    // Format: agent:<port>:<nonce>
    const portNum = Number(agentPort);
    if (!Number.isFinite(portNum) || portNum <= 0 || portNum > 65535) {
      return res.status(400).json({ error: 'Invalid agent port' });
    }
    if (!agentNonce || typeof agentNonce !== 'string' || agentNonce.length < 8) {
      return res.status(400).json({ error: 'Invalid agent nonce' });
    }
    options.state = `agent:${portNum}:${agentNonce}`;
  }
  return passport.authenticate('google', options)(req, res, next);
});

app.get('/api/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: process.env.FRONTEND_URL || 'https://it-asset-project.vercel.app',
    session: false 
  }),
  async (req, res) => {
    try {
      // Generate JWT token
      const token = generateToken(req.user);
      await db.setCurrentUserId(req.user.id);
      
      // Log audit event
      await db.logAuditEvent('users', req.user.id, 'LOGIN', null, { logged_in_via: 'google' }, {
        userId: req.user.id,
        username: req.user.username,
        organizationId: req.user.organization_id || null,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Agent flow: redirect token to the localhost callback server.
      if (typeof req.query.state === 'string' && req.query.state.startsWith('agent:')) {
        const parts = req.query.state.split(':');
        const port = Number(parts[1]);
        const nonce = parts.slice(2).join(':');
        if (Number.isFinite(port) && port > 0 && port <= 65535 && nonce) {
          const callbackUrl = `http://127.0.0.1:${port}/oauth/callback?token=${encodeURIComponent(token)}&nonce=${encodeURIComponent(nonce)}`;
          return res.redirect(callbackUrl);
        }
      }

      // Web app flow
      {
        // Redirect to frontend with token (web app)
        const frontendUrl = process.env.FRONTEND_URL || 'https://it-asset-project.vercel.app';
        res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
      }
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
      lastLogin: user.last_login,
      organization_id: user.organization_id,
      org_role: user.org_role,
      onboarding_completed: user.onboarding_completed,
      trialStartedAt: user.trial_started_at,
      trialEndsAt: user.trial_ends_at,
      trial_started_at: user.trial_started_at,
      trial_ends_at: user.trial_ends_at
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

// ===== ORGANIZATIONS (minimal bootstrap) =====
// Create an organization for the SetupWizard onboarding flow
app.post('/api/organizations', authenticateToken, [
  body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Organization name is required (2-255 characters)'),
  body('plan').optional().trim(),
  body('settings').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsg = errors.array().map(e => e.msg).join(', ');
    console.error('Organization validation errors:', errors.array());
    return res.status(400).json({ error: errorMsg, errors: errors.array() });
  }

  try {
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Invalid token structure' });

    const { name, plan, settings } = req.body;

    // Use system context so we can create/assign even when user has no org yet
    const org = await db.withSystemContext(async (client) => {
      return await authQueries.createOrganizationForExistingUser(userId, name, null, client);
    });

    // Update org with plan and settings if provided
    if (plan || settings) {
      await pool.query(
        'UPDATE organizations SET plan = COALESCE($1, plan), settings = COALESCE($2, settings) WHERE id = $3',
        [plan, settings ? JSON.stringify(settings) : null, org.id]
      );
    }

    const updatedUser = await authQueries.findUserById(userId);
    const token = generateToken(updatedUser);

    return res.status(201).json({ organization: org, token, user: updatedUser });
  } catch (error) {
    const msg = String(error?.message || 'Failed to create organization');
    if (msg.includes('already assigned')) {
      return res.status(409).json({ error: msg });
    }
    console.error('Organization creation error:', error);
    return res.status(500).json({ error: msg });
  }
});

// Create an organization for an existing user who is not assigned to any org yet.
app.post('/api/organizations/bootstrap', authenticateToken, [
  body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Organization name is required'),
  body('domain').optional().trim().isLength({ max: 255 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Invalid token structure' });

    // IMPORTANT: use system context so we can create/assign even when user has no org yet.
    // This endpoint is still protected by JWT and only affects the current user.
    const org = await db.withSystemContext(async (client) => {
      return await authQueries.createOrganizationForExistingUser(userId, req.body.name, req.body.domain || null, client);
    });

    const updatedUser = await authQueries.findUserById(userId);
    const token = generateToken(updatedUser);

    return res.status(201).json({ organization: org, token });
  } catch (error) {
    const msg = String(error?.message || 'Failed to create organization');
    if (msg.includes('already assigned')) {
      return res.status(409).json({ error: msg });
    }
    if (msg.includes('not found')) {
      return res.status(404).json({ error: msg });
    }
    if (error?.code === '23505') {
      // Unique constraint violations
      if (error?.constraint === 'organizations_domain_key') {
        return res.status(409).json({ error: 'An organization with this domain already exists' });
      }
    }
    if (error?.code === '42703' && msg.includes('organization_id')) {
      return res.status(500).json({
        error: 'Organization schema not installed. Run run-org-migration.js with DATABASE_OWNER_URL (schema owner) or rerun with proper privileges.'
      });
    }
    console.error('Organization bootstrap error:', error);
    return res.status(500).json({ error: msg });
  }
});

// Onboarding completion (multi-step, transactional)
app.post('/api/onboarding/complete', authenticateToken, async (req, res) => {
  const userId = req.user?.userId ?? req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Invalid token structure' });

  const payload = req.body || {};
  const userType = payload.userType === 'B2B' ? 'B2B' : 'PRIVATE';

  // Ensure schema exists before running the transaction (owner DSN)
  try {
    await ensureOnboardingFoundationSchema();
  } catch (err) {
    return res.status(500).json({ error: 'Onboarding schema not installed: ' + (err?.message || 'unknown error') });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // RLS/system context for the transaction (use SET LOCAL for transaction scope)
    // This ensures the session variables persist through the entire transaction
    await client.query("SET LOCAL app.system = '1'");
    await client.query(`SET LOCAL app.current_user_id = '${userId.toString()}'`);

    const orgName = userType === 'B2B'
      ? (payload.organization?.name || 'New Organization')
      : 'Personal Workspace';
    const orgDomain = payload.organization?.domain || null;
    const primaryLocationName = userType === 'B2B'
      ? (payload.organization?.primaryLocation || 'Main Office')
      : 'Home';

    // Create org and attach user as owner (idempotent per user)
    const orgResult = await client.query(
      `INSERT INTO organizations (name, domain, plan, billing_tier, subscription_status, subscription_started_at, subscription_current_period_end)
       VALUES ($1, $2, 'trial', 'pro', 'trial', $3, $4)
       ON CONFLICT (domain) WHERE domain IS NOT NULL DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, domain, plan, billing_tier, subscription_status, subscription_started_at, subscription_current_period_end`,
      [String(orgName).trim(), orgDomain, trialStartedAt, trialEndsAt]
    );
    const organizationId = orgResult.rows[0].id;

    await client.query(
      `UPDATE auth_users
         SET organization_id = $2,
             org_role = 'owner',
             role = 'admin'
       WHERE id = $1`,
      [userId, organizationId]
    );

    // Seed default location
    let locationId;
    const locResult = await client.query(
      `INSERT INTO locations (organization_id, name, is_default)
       VALUES ($1, $2, true)
       ON CONFLICT (organization_id) WHERE is_default DO NOTHING
       RETURNING id`,
      [organizationId, primaryLocationName]
    );
    if (locResult.rows[0]?.id) {
      locationId = locResult.rows[0].id;
    } else {
      const existingLoc = await client.query(
        'SELECT id FROM locations WHERE organization_id = $1 AND is_default = true LIMIT 1',
        [organizationId]
      );
      locationId = existingLoc.rows[0]?.id || null;
    }

    // Seed default categories with icon_name
    const defaultCategories = [
      { name: 'Laptop', slug: 'laptop', icon: 'laptop' },
      { name: 'Mobile', slug: 'mobile', icon: 'smartphone' },
      { name: 'Monitor', slug: 'monitor', icon: 'monitor' },
      { name: 'License', slug: 'license', icon: 'key' }
    ];
    const slugToId = new Map();
    for (const cat of defaultCategories) {
      const catResult = await client.query(
        `INSERT INTO asset_categories (organization_id, name, slug, icon_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, slug) DO UPDATE SET name = EXCLUDED.name, icon_name = EXCLUDED.icon_name
         RETURNING id, slug`,
        [organizationId, cat.name, cat.slug, cat.icon]
      );
      slugToId.set(catResult.rows[0].slug, catResult.rows[0].id);
    }

    // Ghost employees (B2B only)
    const employeeEmailToId = new Map();
    if (userType === 'B2B' && Array.isArray(payload.initialEmployees)) {
      for (const emp of payload.initialEmployees) {
        const fullName = emp?.fullName || emp?.email || 'Team Member';
        const email = emp?.email || null;
        const empResult = await client.query(
          `INSERT INTO employees (organization_id, full_name, email, status)
           VALUES ($1, $2, $3, 'active')
           ON CONFLICT (organization_id, email) WHERE email IS NOT NULL DO UPDATE SET full_name = EXCLUDED.full_name, status = 'active'
           RETURNING id, email, full_name`,
          [organizationId, fullName, email]
        );
        const row = empResult.rows[0];
        if (row?.email) employeeEmailToId.set(row.email, row.id);
      }
    }

    // First asset (optional but recommended)
    if (payload.firstAsset) {
      const { categorySlug, modelName, serialNumber, assignedToEmail } = payload.firstAsset;
      const categoryId = slugToId.get(categorySlug) || slugToId.get('laptop') || null;
      const categoryLabel = categorySlug || 'laptop';
      const assignedEmployeeId = assignedToEmail ? employeeEmailToId.get(assignedToEmail) : null;
      const assignedName = userType === 'B2B'
        ? (payload.initialEmployees?.find((e) => e.email === assignedToEmail)?.fullName || assignedToEmail || 'Unassigned')
        : (req.user?.username || req.user?.email || 'Me');

      // Keep legacy columns populated for compatibility
      await client.query(
        `INSERT INTO assets (
           asset_tag, asset_type, manufacturer, model, serial_number,
           assigned_user_name, status, cost, discovered,
           user_id, category, category_id, location, location_id, assigned_to
         ) VALUES ($1, $2, $3, $4, $5, $6, 'In Use', 0, false, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          `AST-${Date.now()}`,
          'hardware',
          null,
          modelName || 'Quick Add',
          serialNumber || 'N/A',
          assignedName,
          userId, // owner for visibility
          categoryLabel,
          categoryId,
          primaryLocationName,
          locationId,
          assignedEmployeeId || null
        ]
      );
    }

    // Mark onboarding complete
    await client.query('UPDATE auth_users SET onboarding_completed = TRUE WHERE id = $1', [userId]);

    await client.query('COMMIT');

    const updatedUser = await authQueries.findUserById(userId);
    const token = generateToken(updatedUser);

    // TODO: Trigger Welcome Email via Resend once API key wired.

    return res.status(201).json({
      organization: { id: organizationId, name: orgName },
      token
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('Onboarding completion error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to complete onboarding' });
  } finally {
    client.release();
  }
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

function buildAuditFiltersFromQuery(query, organizationId) {
  const MAX_LIMIT = 5000;
  const parsedLimit = query.limit ? parseInt(query.limit) : 1000;

  return {
    organizationId: organizationId || null,
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
    const { userId, organizationId } = await resolveUserOrgContext(req);
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use csv or json.' });
    }

    const filters = buildAuditFiltersFromQuery(req.query, organizationId);
    const logs = await db.getAuditLogs(filters);

    // Log export event after fetching so the export output doesn't include itself.
    await db.logAuditEvent('audit_logs', 0, 'EXPORT', null, {
      format,
      filters,
      resultCount: Array.isArray(logs) ? logs.length : 0
    }, {
      userId,
      username: req.user?.username,
      organizationId,
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
    const { userId, organizationId } = await resolveUserOrgContext(req);
    
    const filters = buildAuditFiltersFromQuery(req.query, organizationId);

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

// ===== ANALYTICS ROUTES =====

// Get dashboard analytics (accessible to all authenticated users)
app.get('/api/analytics/dashboard', authenticateToken, authorize('analytics:view'), async (req, res) => {
  try {
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token structure' });
    }
    
    await db.setCurrentUserId(userId);
    
    // Get user from database to verify role and organization
    const user = await authQueries.findUserById(userId);
    const role = typeof user?.role === 'string' ? user.role.toLowerCase() : 'user';
    const organizationId = user?.organization_id || null;
    
    // SECURITY: Require organization for multi-tenant isolation
    if (!organizationId) {
      return res.status(403).json({ error: 'User must belong to an organization to view analytics' });
    }
    
    // Structured diagnostics to aid troubleshooting 403s
    console.log('[analytics:view] access', {
      userId,
      role,
      organizationId,
      tokenRole: req.user?.role,
      permissions: req.user?.permissions
    });
    
    // Cache analytics per organization (expensive query)
    const cacheKey = `analytics:org:${organizationId}`;
    const analytics = await getCached(cacheKey, async () => {
      return await db.getDashboardAnalytics(role, userId, organizationId);
    }, 30); // Cache for 30 seconds (analytics should be fairly fresh)
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Export data to CSV
app.get('/api/analytics/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    const { type = 'all' } = req.query;
    const data = await db.getExportData(type);
    
    // Convert to CSV format
    const convertToCSV = (rows, headers) => {
      if (!rows || rows.length === 0) return '';
      
      const csvHeaders = headers || Object.keys(rows[0]);
      const csvRows = rows.map(row => 
        csvHeaders.map(field => {
          const value = row[field];
          // Escape quotes and wrap in quotes if contains comma, newline, or quote
          if (value === null || value === undefined) return '';
          const str = String(value);
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(',')
      );
      
      return [csvHeaders.join(','), ...csvRows].join('\n');
    };

    let csvContent = '';
    
    if (data.assets) {
      csvContent += '=== ASSETS ===\n';
      csvContent += convertToCSV(data.assets);
      csvContent += '\n\n';
    }
    
    if (data.licenses) {
      csvContent += '=== LICENSES ===\n';
      csvContent += convertToCSV(data.licenses);
      csvContent += '\n\n';
    }
    
    if (data.contracts) {
      csvContent += '=== CONTRACTS ===\n';
      csvContent += convertToCSV(data.contracts);
      csvContent += '\n\n';
    }
    
    if (data.consumables) {
      csvContent += '=== CONSUMABLES ===\n';
      csvContent += convertToCSV(data.consumables);
      csvContent += '\n\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="itam-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// ===== ASSET ROUTES (Protected) =====

async function resolveUserOrgContext(req) {
  const userId = req.user?.userId ?? req.user?.id;
  if (!userId) {
    throw new Error('Invalid token structure');
  }

  await db.setCurrentUserId(userId);

  let organizationId = req.user?.organizationId || null;
  let dbUser = null;
  if (!organizationId || req.user?.role === 'admin') {
    dbUser = await authQueries.findUserById(userId);
    organizationId = organizationId || dbUser?.organization_id || null;
  }

  if (!organizationId) {
    throw new Error('Organization not set for user');
  }

  const isAdmin = typeof (dbUser?.role || req.user?.role) === 'string' && (dbUser?.role || req.user?.role).toLowerCase() === 'admin';
  return { userId, organizationId, isAdmin, dbUser };
}

// Get all assets (RLS: users see only their own, admins see all)
app.get('/api/assets', authenticateToken, async (req, res) => {
  try {
    const { userId, organizationId, isAdmin } = await resolveUserOrgContext(req);

    // Cache key includes org and user context for proper isolation
    const cacheKey = isAdmin 
      ? `assets:org:${organizationId}:all`
      : `assets:org:${organizationId}:user:${userId}`;
    
    const assets = await getCached(cacheKey, async () => {
      return isAdmin
        ? await db.getAllAssets(organizationId)
        : await db.getAssetsForUser(userId, organizationId);
    }, 60); // Cache for 60 seconds
    
    res.json(assets);
  } catch (error) {
    res.status(error.message === 'Organization not set for user' ? 400 : 500).json({ error: error.message });
  }
});

// Get asset by ID (RLS: users see only their own, admins see all)
app.get('/api/assets/:id', authenticateToken, async (req, res) => {
  try {
    const { userId, organizationId, isAdmin } = await resolveUserOrgContext(req);

    const asset = isAdmin
      ? await db.getAssetById(req.params.id, organizationId)
      : await db.getAssetByIdForUser(req.params.id, userId, organizationId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (error) {
    res.status(error.message === 'Organization not set for user' ? 400 : 500).json({ error: error.message });
  }
});

// Search assets (RLS: users see only their own, admins see all)
app.get('/api/assets/search/:query', authenticateToken, async (req, res) => {
  try {
    const { userId, organizationId, isAdmin } = await resolveUserOrgContext(req);

    const assets = isAdmin
      ? await db.searchAssets(req.params.query, organizationId)
      : await db.searchAssetsForUser(req.params.query, userId, organizationId);
    res.json(assets);
  } catch (error) {
    res.status(error.message === 'Organization not set for user' ? 400 : 500).json({ error: error.message });
  }
});

// Get asset statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getAssetStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// Create new asset (Admin-only)
app.post('/api/assets', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, organizationId } = await resolveUserOrgContext(req);
    
    // Set current user for RLS policies
    await db.setCurrentUserId(userId);
    
    // If user_id not provided in body, assign to requesting user (for admins creating for users)
    const assetData = {
      ...req.body,
      user_id: req.body.user_id || userId,  // Default to current user if not specified
      organization_id: organizationId
    };
    
    console.log('[asset-create] Creating asset:', { assetData, userId, organizationId });
    const asset = await db.createAsset(assetData);
    console.log('[asset-create] Asset created successfully:', asset?.id);
    
    // Send email if asset assigned to user with email
    if (req.body.assigned_to && req.body.assigned_user_email) {
      emailService.sendAssetAssignmentEmail(
        req.body.assigned_user_email,
        req.body.assigned_to,
        asset.asset_tag,
        asset.asset_type,
        asset.category
      ).catch(err => console.error('Failed to send asset assignment email:', err));
    }
    
    // Log audit event
    await db.logAuditEvent('assets', asset.id, 'CREATE', null, asset, {
      userId: req.user.id,
      username: req.user.username,
      organizationId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Invalidate assets cache for this organization
    await invalidateCache(`assets:org:${organizationId}:*`);
    
    res.status(201).json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update asset (Admin-only)
app.put('/api/assets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, organizationId } = await resolveUserOrgContext(req);
    await db.setCurrentUserId(userId);

    if (req.body.organization_id && Number(req.body.organization_id) !== Number(organizationId)) {
      return res.status(403).json({ error: 'organization_id cannot be changed' });
    }

    const oldAsset = await db.getAssetById(req.params.id, organizationId);
    if (!oldAsset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const asset = await db.updateAsset(req.params.id, { ...req.body, organization_id: organizationId }, organizationId);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Send email if assignment changed and email provided
    if (req.body.assigned_to && req.body.assigned_user_email && 
        oldAsset.assigned_to !== req.body.assigned_to) {
      emailService.sendAssetAssignmentEmail(
        req.body.assigned_user_email,
        req.body.assigned_to,
        asset.asset_tag,
        asset.asset_type,
        asset.category
      ).catch(err => console.error('Failed to send asset assignment email:', err));
    }
    
    // Log audit event
    await db.logAuditEvent('assets', asset.id, 'UPDATE', oldAsset, asset, {
      userId: req.user.id,
      username: req.user.username,
      organizationId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Invalidate assets cache for this organization
    await invalidateCache(`assets:org:${organizationId}:*`);
    
    res.json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete asset
app.delete('/api/assets/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, organizationId } = await resolveUserOrgContext(req);
    await db.setCurrentUserId(userId);

    const asset = await db.deleteAsset(req.params.id, organizationId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Log audit event
    await db.logAuditEvent('assets', asset.id, 'DELETE', asset, null, {
      userId: req.user.id,
      username: req.user.username,
      organizationId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Invalidate assets cache for this organization
    await invalidateCache(`assets:org:${organizationId}:*`);
    
    res.json({ message: 'Asset deleted', asset });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// --- LICENSES ROUTES ---

// Get all licenses
app.get('/api/licenses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, organizationId } = await resolveUserOrgContext(req);
    await db.setCurrentUserId(userId);

    const cacheKey = `licenses:org:${organizationId}`;
    const licenses = await getCached(cacheKey, async () => {
      return await db.getAllLicenses(organizationId);
    }, 120); // Cache for 2 minutes
    res.json(licenses);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// Search licenses
app.get('/api/licenses/search/:query', authenticateToken, async (req, res) => {
  try {
    const { userId, organizationId } = await resolveUserOrgContext(req);
    await db.setCurrentUserId(userId);
    const licenses = await db.searchLicenses(req.params.query, organizationId);
    res.json(licenses);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// Create new license
app.post('/api/licenses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, organizationId } = await resolveUserOrgContext(req);
    await db.setCurrentUserId(userId);

    const licenseData = { ...req.body, organization_id: organizationId };
    console.log('📝 Creating license with data:', licenseData);
    const license = await db.createLicense(licenseData);
    console.log('✅ License created:', license);
    
    // Audit log
    await db.logAuditEvent('licenses', license.id, 'CREATE', null, license, {
      userId: req.user.id,
      username: req.user.username,
      organizationId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Invalidate cache
    await invalidateCache(`licenses:org:${organizationId}`);
    await invalidateCache('analytics:*');
    
    res.status(201).json(license);
  } catch (error) {
    console.error('❌ License creation error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Update license
app.put('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, organizationId } = await resolveUserOrgContext(req);
    await db.setCurrentUserId(userId);

    console.log('📝 Updating license', req.params.id, 'with data:', req.body);
    
    // Get old license for audit
    const oldLicense = await db.getLicenseById(req.params.id, organizationId);
    const license = await db.updateLicense(req.params.id, { ...req.body, organization_id: organizationId });
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    console.log('✅ License updated:', license);
    
    // Audit log
    await db.logAuditEvent('licenses', license.id, 'UPDATE', oldLicense, license, {
      userId: req.user.id,
      username: req.user.username,
      organizationId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Invalidate cache
    await invalidateCache(`licenses:org:${organizationId}`);
    await invalidateCache('analytics:*');
    
    res.json(license);
  } catch (error) {
    console.error('❌ License update error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Delete license
app.delete('/api/licenses/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, organizationId } = await resolveUserOrgContext(req);
    await db.setCurrentUserId(userId);

    const license = await db.deleteLicense(req.params.id, organizationId);
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    
    // Audit log
    await db.logAuditEvent('licenses', license.id, 'DELETE', license, null, {
      userId: req.user.id,
      username: req.user.username,
      organizationId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Invalidate cache
    await invalidateCache(`licenses:org:${organizationId}`);
    await invalidateCache('analytics:*');
    
    res.json({ message: 'License deleted', license });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// --- USERS ROUTES ---

// Get all users
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await getCached('users:all', async () => {
      return await db.getAllUsers();
    }, 60); // Cache for 60 seconds
    res.json(users);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// Search users
app.get('/api/users/search/:query', authenticateToken, async (req, res) => {
  try {
    const users = await db.searchUsers(req.params.query);
    res.json(users);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// Create new user
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await db.createUser(req.body);
    
    // Send welcome email if email provided (non-blocking)
    if (user.email) {
      emailService.sendWelcomeEmail(
        user.email,
        user.username,
        req.body.password // Send temp password if provided
      ).catch(err => console.error('Failed to send welcome email:', err));
    }
    
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
    res.status(500).json(safeError(error));
  }
});

// --- CONTRACTS ROUTES ---

// Get all contracts
app.get('/api/contracts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const contracts = await getCached('contracts:all', async () => {
      return await db.getAllContracts();
    }, 120); // Cache for 2 minutes
    res.json(contracts);
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// Search contracts
app.get('/api/contracts/search/:query', authenticateToken, async (req, res) => {
  try {
    const contracts = await db.searchContracts(req.params.query);
    res.json(contracts);
  } catch (error) {
    res.status(500).json(safeError(error));
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
    
    // Invalidate cache
    await invalidateCache('contracts:*');
    await invalidateCache('analytics:*');
    
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
    
    // Invalidate cache
    await invalidateCache('contracts:*');
    await invalidateCache('analytics:*');
    
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
    
    // Invalidate cache
    await invalidateCache('contracts:*');
    await invalidateCache('analytics:*');
    
    res.json({ message: 'Contract deleted', contract });
  } catch (error) {
    res.status(500).json(safeError(error));
  }
});

// ===== DIGITAL RECEIPTS ROUTES =====

// Handle CORS preflight for receipts routes
app.options('/api/assets/:id/receipts', cors());
app.options('/api/receipts/:id', cors());
app.options('/api/receipts/all', cors());

// Upload receipt for an asset
app.post('/api/assets/:id/receipts', cors(), authenticateToken, requireAdmin, upload.single('receipt'), async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const assetId = parseInt(req.params.id);
    let parsedData = null;
    let merchant = null;
    let purchaseDate = null;
    let totalAmount = null;
    let taxAmount = null;
    let currency = null;
    let parsingStatus = 'not_parsed'; // OCR removed - receipts stored only
    
    // OCR parsing removed - receipts are uploaded and stored without text extraction
    parsedData = null;

    const receipt = await db.createReceipt(assetId, {
      file_name: req.file.originalname,
      file_path: `/uploads/receipts/${req.file.filename}`,
      file_size: req.file.size,
      file_type: req.file.mimetype,
      description: req.body.description || null,
      uploaded_by: req.user.userId,
      uploaded_by_name: req.user.username,
      user_id: req.user.userId,
      merchant,
      purchase_date: purchaseDate,
      total_amount: totalAmount,
      tax_amount: taxAmount,
      currency,
      parsed_data: parsedData,
      parsing_status: parsingStatus
    });

    res.status(201).json(receipt);
  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// Get all receipts for an asset
app.get('/api/assets/:id/receipts', cors(), authenticateToken, requireAdmin, async (req, res) => {
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

// Get all receipts across all assets
app.get('/api/receipts/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    
    const receipts = await db.getAllReceipts();
    res.json(receipts);
  } catch (error) {
    console.error('Get all receipts error:', error);
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

// Agent device IDs come from the machine hostname. In a multi-user / multi-tenant
// setup, the same hostname may appear under different users over time (testing,
// reassignments, shared machines). Since `devices.device_id` is unique, a plain
// hostname can collide across users and cause RLS failures on upsert.
//
// Solution: namespace the DB-facing device_id by userId, while keeping the raw
// hostname in `devices.hostname` for display/debugging.
function canonicalizeAgentDeviceId(rawDeviceId, userId) {
  const base = String(rawDeviceId || '').trim();
  if (!base) return base;
  const suffix = `::${userId}`;
  if (base.endsWith(suffix)) return base;
  return `${base}${suffix}`;
}

function logAgentDeviceIdMapping(route, rawDeviceId, canonicalDeviceId, userId) {
  if (process.env.DEBUG_AGENT_DEVICE_ID !== '1') return;
  console.log(`[agent-device-id] route=${route} userId=${userId} raw=${rawDeviceId} canonical=${canonicalDeviceId}`);
}

// Receive usage data from agent
app.post('/api/agent/usage', authenticateToken, async (req, res) => {
  try {
    const { device_id, app_name, window_title, duration, timestamp } = req.body;
    const { userId } = req.user; // Get from JWT token (secure)
    
    if (!device_id || !app_name) {
      return res.status(400).json({ error: 'device_id and app_name are required' });
    }

    const rawDeviceId = device_id;
    const canonicalDeviceId = canonicalizeAgentDeviceId(rawDeviceId, userId);
    logAgentDeviceIdMapping('/api/agent/usage', rawDeviceId, canonicalDeviceId, userId);

    // Use withRLSContext to ensure RLS variable and queries use the SAME database connection
    // This fixes the connection pooling issue where setCurrentUserId and queries could use different connections
    const usageData = await db.withRLSContext(userId, async (client) => {
      // Ensure device exists first (auto-create if needed)
      await db.upsertDevice({
        device_id: canonicalDeviceId,
        user_id: userId, // Associate device with user
        hostname: rawDeviceId,
        os_name: 'Unknown',
        os_version: 'Unknown',
        timestamp: Date.now()
      }, client);

      // Insert usage data using the same client
      return await db.insertUsageData({
        device_id: canonicalDeviceId,
        user_id: userId, // Associate usage with user
        app_name,
        window_title: window_title || '',
        duration: duration || 0,
        timestamp: timestamp || Date.now()
      }, client);
    });

    res.status(201).json({ 
      message: 'Usage data recorded',
      data: usageData
    });
  } catch (error) {
    console.error('Error recording usage data:', error);
    res.status(500).json(safeError(error));
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

    const rawDeviceId = device_id;
    const canonicalDeviceId = canonicalizeAgentDeviceId(rawDeviceId, userId);
    logAgentDeviceIdMapping('/api/agent/heartbeat', rawDeviceId, canonicalDeviceId, userId);

    // Set PostgreSQL session variable for Row-Level Security
    await db.setCurrentUserId(userId);

    // Update or create device
    await db.upsertDevice({
      device_id: canonicalDeviceId,
      hostname: hostname || rawDeviceId,
      os_name,
      os_version,
      user_id: userId
    });

    // Record heartbeat
    await db.insertHeartbeat({
      device_id: canonicalDeviceId,
      timestamp: timestamp || Date.now()
    });

    // Invalidate device cache for this user
    await invalidateCache(`devices:user:${userId}`);

    res.json({ 
      message: 'Heartbeat received',
      device_id: rawDeviceId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error recording heartbeat:', error);
    res.status(500).json(safeError(error));
  }
});

// Receive installed apps list from agent
app.post('/api/agent/apps', authenticateToken, async (req, res) => {
  try {
    const { device_id, apps } = req.body;
    const { userId } = req.user;
    
    if (!device_id || !Array.isArray(apps)) {
      return res.status(400).json({ error: 'device_id and apps array are required' });
    }

    const rawDeviceId = device_id;
    const canonicalDeviceId = canonicalizeAgentDeviceId(rawDeviceId, userId);
    logAgentDeviceIdMapping('/api/agent/apps', rawDeviceId, canonicalDeviceId, userId);

    await db.upsertInstalledApps(canonicalDeviceId, apps);

    res.json({ 
      message: 'Installed apps updated',
      count: apps.length
    });
  } catch (error) {
    console.error('Error updating installed apps:', error);
    res.status(500).json(safeError(error));
  }
});

// Get device usage statistics
app.get('/api/agent/devices', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.user; // From JWT

    // IMPORTANT: bind RLS + query to the SAME DB connection
    // Otherwise setCurrentUserId can run on one pooled connection and the
    // subsequent SELECT runs on another (leading to empty/incorrect results).

    // Cache devices per user (5 minutes TTL)
    const cacheKey = `devices:user:${userId}`;
    const devices = await getCached(cacheKey, async () => {
      return await db.withRLSContext(userId, async () => {
        return await db.getAllDevices();
      });
    }, 300); // 5 minutes cache
    
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json(safeError(error));
  }
});

// Get specific device usage stats
app.get('/api/agent/devices/:deviceId/usage', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startDate, endDate } = req.query;
    const { userId } = req.user; // From JWT

    const usage = await db.withRLSContext(userId, async () => {
      // Row-Level Security will automatically filter - users can only see their own device usage
      return await db.getDeviceUsageStats(deviceId, startDate, endDate);
    });
    res.json(usage);
  } catch (error) {
    console.error('Error fetching device usage:', error);
    res.status(500).json(safeError(error));
  }
});

// Get app usage summary across all devices
app.get('/api/agent/apps/usage', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { userId } = req.user; // From JWT

    const appUsage = await db.withRLSContext(userId, async () => {
      // Row-Level Security will automatically filter - users see only their devices' apps
      return await db.getAppUsageSummary(startDate, endDate);
    });
    res.json(appUsage);
  } catch (error) {
    console.error('Error fetching app usage:', error);
    res.status(500).json(safeError(error));
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
    res.status(500).json(safeError(error));
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
    res.status(500).json(safeError(error));
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
    res.status(500).json(safeError(error));
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
    res.status(500).json(safeError(error));
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
    res.status(500).json(safeError(error));
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

    const rawDeviceId = req.body.device_id;
    const canonicalDeviceId = canonicalizeAgentDeviceId(rawDeviceId, userId);
    logAgentDeviceIdMapping('/api/alerts', rawDeviceId, canonicalDeviceId, userId);
    
    const alertData = {
      device_id: canonicalDeviceId,
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
    res.status(500).json(safeError(error));
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
    res.status(500).json(safeError(error));
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
    res.status(500).json(safeError(error));
  }
});

// ============ PAYMENTS (PayPal) ============

// Payments history (stored in DB).
// - Regular users: only their own payments
// - Admins: can request all payments with ?all=true
app.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId ?? req.user?.id;
    const role = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token structure' });
    }

    await db.setCurrentUserId(userId);

    const limit = req.query.limit;
    const offset = req.query.offset;
    const all = String(req.query.all || '').toLowerCase() === 'true';

    try {
      if (all && role === 'admin') {
        const rows = await db.getAllPayments({ limit, offset });
        return res.json({ payments: rows });
      }

      const rows = await db.getPaymentsForUser(userId, { limit, offset });
      return res.json({ payments: rows });
    } catch (dbError) {
      // If the payments table schema is out of sync in a given environment, don't break the app.
      // Payments persistence is helpful but should not block core functionality.
      const message = String(dbError?.message || '');
      if (dbError?.code === '42703' || message.toLowerCase().includes('order_id')) {
        return res.json({ payments: [], warning: 'Payments persistence is not configured in this environment yet.' });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.post('/api/payments/paypal/order', paymentLimiter, authenticateToken, [
  body('amount').optional().isFloat({ gt: 0 }).withMessage('amount must be a positive number'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('currency must be a 3-letter code'),
  body('description').optional().isString().isLength({ max: 255 }),
  body('plan').optional().isIn(['regular', 'enterprise']).withMessage('plan must be regular or enterprise')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user?.userId ?? req.user?.id;
    let organizationId = req.user?.organizationId || null;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token structure' });
    }
    await db.setCurrentUserId(userId);

    // Get organization ID if not in token
    if (!organizationId) {
      const dbUser = await authQueries.findUserById(userId);
      organizationId = dbUser?.organization_id || null;
    }

    const plan = String(req.body.plan || 'starter').toLowerCase();
    const starterPriceCents = Number.parseInt(process.env.PAYPAL_STARTER_PRICE_CENTS || '2500', 10);
    const proPriceCents = Number.parseInt(process.env.PAYPAL_PRO_PRICE_CENTS || '2900', 10);
    const enterprisePriceCents = Number.parseInt(process.env.PAYPAL_ENTERPRISE_PRICE_CENTS || '9900', 10);
    const cents = plan === 'enterprise' ? enterprisePriceCents : (plan === 'regular' ? proPriceCents : starterPriceCents);
    if (!Number.isFinite(cents) || cents <= 0) {
      return res.status(500).json({ error: 'Server billing configuration is invalid' });
    }

    const currency = (req.body.currency || 'USD').toUpperCase();
    if (!paypalCurrencySet.has(currency)) {
      return res.status(400).json({ error: 'Unsupported currency' });
    }

    // Pricing is configured in USD cents. Reject other currencies until explicit pricing is added.
    if (currency !== 'USD') {
      return res.status(400).json({ error: 'Only USD is supported for subscriptions right now' });
    }

    const description = req.body.description || `IT Asset subscription - ${plan === 'enterprise' ? 'Enterprise' : 'Pro'}`;
    const returnUrl = `${FRONTEND_BASE_URL}/paypal/return`;
    const cancelUrl = `${FRONTEND_BASE_URL}/paypal/cancel`;

    const customId = organizationId ? `org:${organizationId};user:${userId}` : `user:${userId}`;

    const order = await createPayPalOrder({
      amount: centsToValue(cents),
      currency,
      description,
      returnUrl,
      cancelUrl,
      customId
    });

    if (!order?.orderId) {
      return res.status(500).json({ error: 'Failed to create PayPal order' });
    }

    try {
      await db.createPaymentRecord({
        orderId: order.orderId,
        userId,
        amountCents: cents,
        currency,
        status: order.status || 'CREATED',
        intent: 'CAPTURE',
        description,
        metadata: { source: 'api', plan, custom_id: customId }
      });
    } catch (dbError) {
      // Don't fail order creation due to payments table schema drift.
      console.warn('[payments] Failed to persist payment order (non-blocking):', dbError?.message || dbError);
    }

    res.json({
      orderId: order.orderId,
      approveUrl: order.approveUrl,
      status: order.status || 'CREATED'
    });
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.post('/api/payments/paypal/capture', paymentLimiter, authenticateToken, [
  body('orderId').isString().notEmpty().withMessage('orderId is required'),
  body('plan').optional().isString()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { orderId, plan = 'regular' } = req.body;
  try {
    const userId = req.user?.userId ?? req.user?.id;
    const role = req.user?.role;
    let organizationId = req.user?.organizationId || null;
    
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token structure' });
    }
    await db.setCurrentUserId(userId);

    // Get organization ID if not in token
    if (!organizationId) {
      const dbUser = await authQueries.findUserById(userId);
      organizationId = dbUser?.organization_id || null;
    }

    // Validate that the order was created for this org/user without relying on DB persistence.
    // Fail closed if verification is not possible (except admin).
    try {
      const orderDetails = await getPayPalOrder(orderId);
      const customId = orderDetails?.purchaseUnits?.[0]?.custom_id;
      if (customId) {
        const parts = String(customId)
          .split(';')
          .map((p) => p.trim())
          .filter(Boolean);
        const map = new Map(parts.map((p) => {
          const [k, ...rest] = p.split(':');
          return [String(k || '').trim(), rest.join(':').trim()];
        }));
        const cidUser = map.get('user');
        const cidOrg = map.get('org');

        if (cidUser && String(cidUser) !== String(userId) && role !== 'admin') {
          return res.status(403).json({ error: 'Forbidden' });
        }
        if (organizationId && cidOrg && String(cidOrg) !== String(organizationId) && role !== 'admin') {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
    } catch (verifyError) {
      if (role !== 'admin') {
        console.warn('[paypal] Failed to fetch order details for verification (blocked):', verifyError?.message || verifyError);
        return res.status(503).json({ error: 'Unable to verify PayPal order at this time. Please retry.' });
      }
      console.warn('[paypal] Failed to fetch order details for verification (admin override):', verifyError?.message || verifyError);
    }

    const result = await capturePayPalOrder(orderId);

    if (!result?.captureId) {
      return res.status(500).json({ error: 'Failed to capture order' });
    }

    const normalizedPlan = String(plan || 'starter').toLowerCase();
    const starterPriceCents = Number.parseInt(process.env.PAYPAL_STARTER_PRICE_CENTS || '2500', 10);
    const proPriceCents = Number.parseInt(process.env.PAYPAL_PRO_PRICE_CENTS || '2900', 10);
    const enterprisePriceCents = Number.parseInt(process.env.PAYPAL_ENTERPRISE_PRICE_CENTS || '9900', 10);
    const expectedCents = normalizedPlan === 'enterprise' ? enterprisePriceCents : (normalizedPlan === 'regular' ? proPriceCents : starterPriceCents);
    const capturedCurrency = (result?.amount?.currency_code || 'USD').toUpperCase();
    const capturedCents = result?.amount?.value ? toCents(result.amount.value) : null;

    // Persist capture details if the payments table exists with the expected schema.
    try {
      const amountCents = result?.amount?.value ? toCents(result.amount.value) : null;
      await db.createPaymentRecord({
        orderId,
        captureId: result.captureId,
        userId,
        amountCents: amountCents || 0,
        currency: capturedCurrency,
        status: result.status || 'CAPTURED',
        intent: 'CAPTURE',
        payerEmail: result.payerEmail,
        payerName: result.payerName,
        metadata: result.raw || {}
      });
    } catch (dbError) {
      console.warn('[payments] Failed to persist capture (non-blocking):', dbError?.message || dbError);
    }

    // ✅ UPGRADE ORGANIZATION TO PRO after successful payment!
    const amountMatches = capturedCents !== null && Number.isFinite(expectedCents) && capturedCents === expectedCents;
    const currencyMatches = capturedCurrency === 'USD';
    if (organizationId && result.status === 'COMPLETED' && amountMatches && currencyMatches) {
      const billingTier = normalizedPlan === 'enterprise' ? 'enterprise' : 'pro';
      await db.withSystemContext(async (client) => {
        await db.setOrganizationSubscription(organizationId, {
          billingTier,
          subscriptionStatus: 'active',
          subscriptionStartedAt: new Date(),
          subscriptionCurrentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }, client);
      });
      console.log(`[billing] ✅ Upgraded org ${organizationId} to ${billingTier} after PayPal payment ${orderId}`);
    } else if (organizationId && result.status === 'COMPLETED' && (!amountMatches || !currencyMatches)) {
      console.warn('[billing] Payment completed but amount/currency mismatch - not upgrading.', {
        organizationId,
        orderId,
        normalizedPlan,
        expectedCents,
        capturedCents,
        capturedCurrency
      });
    }

    res.json({
      status: result.status || 'CAPTURED',
      captureId: result.captureId,
      payerEmail: result.payerEmail,
      payerName: result.payerName,
      upgraded: organizationId ? (result.status === 'COMPLETED' && amountMatches && currencyMatches) : false
    });
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    res.status(500).json({ error: 'Failed to capture order' });
  }
});

app.post('/api/payments/paypal/webhook', async (req, res) => {
  const body = req.body;
  const rawBody = req.rawBody;
  const eventId = body?.id;
  const eventType = body?.event_type;

  if (!rawBody) {
    return res.status(400).json({ error: 'Missing raw body for verification' });
  }

  try {
    const verified = await verifyWebhookSignature(req.headers, body);
    if (!verified) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const inserted = await db.logWebhookEvent(eventId, eventType, 'received', body);
    if (!inserted) {
      return res.status(200).json({ status: 'duplicate' });
    }

    const resource = body?.resource || {};
    const orderId = resource?.id || resource?.supplementary_data?.related_ids?.order_id;
    const captureId = resource?.id;
    const amountValue = resource?.amount?.value || resource?.purchase_units?.[0]?.amount?.value;
    const amountCurrency = (resource?.amount?.currency_code || resource?.purchase_units?.[0]?.amount?.currency_code || 'USD').toUpperCase();
    const amountCents = amountValue ? toCents(amountValue) : null;
    const payerEmail = resource?.payer?.email_address || resource?.payer_email;
    const payerName = resource?.payer?.name ? `${resource.payer.name.given_name || ''} ${resource.payer.name.surname || ''}`.trim() : null;

    if (orderId) {
      const existing = await db.getPaymentByOrderId(orderId);
      if (existing) {
        await db.updatePaymentStatus(orderId, {
          status: eventType || existing.status,
          captureId: captureId || existing.capture_id,
          payerEmail: payerEmail || existing.payer_email,
          payerName: payerName || existing.payer_name,
          metadata: resource || existing.metadata
        });
      } else {
        await db.createPaymentRecord({
          orderId,
          captureId,
          userId: null,
          amountCents: amountCents || 0,
          currency: amountCurrency,
          status: eventType || 'WEBHOOK',
          intent: 'CAPTURE',
          payerEmail,
          payerName,
          metadata: resource || {}
        });
      }
    }

    await db.markWebhookProcessed(eventId, 'processed');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    try {
      if (eventId) {
        await db.markWebhookProcessed(eventId, 'failed');
      }
    } catch {}
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// ============ BILLING (Company subscriptions) ============

// Get current organization's billing status
app.get('/api/billing', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId ?? req.user?.id;
    let organizationId = req.user?.organizationId || null;
    if (!userId) return res.status(401).json({ error: 'Invalid token structure' });

    // Prefer token claim, but fall back to DB for backwards compatibility and post-bootstrap tokens.
    if (!organizationId) {
      const dbUser = await authQueries.findUserById(userId);
      organizationId = dbUser?.organization_id || null;
    }

    // Not an error state for the client UI; user simply needs to bootstrap an organization.
    if (!organizationId) {
      return res.json({ billing: null, needsOrganization: true });
    }

    await db.setCurrentUserId(userId);
    const billing = await db.getOrganizationBilling(organizationId);
    if (!billing) return res.status(404).json({ error: 'Organization not found' });

    return res.json({ billing });
  } catch (error) {
    console.error('Error fetching billing status:', error);
    res.status(500).json({ error: 'Failed to fetch billing status' });
  }
});

// Store an approved PayPal subscription against the current organization.
// This is called from the client after PayPal returns subscriptionID.
app.post('/api/billing/paypal/subscription/approve', paymentLimiter, authenticateToken, [
  body('subscriptionId').isString().notEmpty().withMessage('subscriptionId is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user?.userId ?? req.user?.id;
    let organizationId = req.user?.organizationId || null;
    if (!userId) return res.status(401).json({ error: 'Invalid token structure' });

    if (!organizationId) {
      const dbUser = await authQueries.findUserById(userId);
      organizationId = dbUser?.organization_id || null;
    }

    if (!organizationId) {
      return res.status(409).json({
        error: 'You must create or join an organization before subscribing.'
      });
    }

    // Defense-in-depth: verify org_role in DB (don’t trust JWT claim alone)
    const dbUser = await authQueries.findUserById(userId);
    const orgRole = String(dbUser?.org_role || '').toLowerCase();
    if (!['owner', 'admin'].includes(orgRole)) {
      return res.status(403).json({ error: 'Only organization owners/admins can manage billing' });
    }

    await db.setCurrentUserId(userId);

    const { subscriptionId } = req.body;
    const subscription = await getPayPalSubscription(subscriptionId);
    const expectedPlanId = process.env.PAYPAL_REGULAR_PLAN_ID;
    if (expectedPlanId && subscription?.plan_id && subscription.plan_id !== expectedPlanId) {
      return res.status(400).json({ error: 'Subscription plan does not match REGULAR plan' });
    }

    const normalizedStatus = normalizePayPalSubscriptionStatus(subscription?.status);
    const startedAt = subscription?.start_time ? new Date(subscription.start_time) : null;
    const nextBilling = subscription?.billing_info?.next_billing_time ? new Date(subscription.billing_info.next_billing_time) : null;

    const updated = await db.setOrganizationSubscription(
      organizationId,
      {
        paypalSubscriptionId: subscriptionId,
        subscriptionStatus: normalizedStatus,
        subscriptionStartedAt: startedAt,
        subscriptionCurrentPeriodEnd: nextBilling,
        billingTier: 'regular'
      }
    );

    // Track subscription activation
    subscriptionEvents.inc({ event_type: 'activated', plan: 'regular' });

    return res.json({ billing: updated, paypalStatus: subscription?.status || null });
  } catch (error) {
    console.error('Error approving subscription:', error);
    res.status(500).json({ error: 'Failed to approve subscription' });
  }
});

// Activate Enterprise for a specific organization (platform admin)
app.post('/api/billing/enterprise/activate', authenticateToken, requireAdmin, [
  body('organizationId').isInt({ gt: 0 }).withMessage('organizationId is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const organizationId = Number(req.body.organizationId);

    const updated = await db.withSystemContext(async (client) => {
      return await db.setOrganizationBillingTier(
        organizationId,
        { billingTier: 'enterprise', subscriptionStatus: 'active' },
        client
      );
    });

    if (!updated) return res.status(404).json({ error: 'Organization not found' });
    return res.json({ billing: updated });
  } catch (error) {
    console.error('Error activating enterprise:', error);
    res.status(500).json({ error: 'Failed to activate enterprise' });
  }
});

// PayPal subscription webhooks (server-to-server)
app.post('/api/billing/paypal/webhook', async (req, res) => {
  const body = req.body;
  const rawBody = req.rawBody;
  const eventId = body?.id;
  const eventType = body?.event_type;

  if (!rawBody) {
    return res.status(400).json({ error: 'Missing raw body for verification' });
  }

  try {
    const verified = await verifyWebhookSignature(req.headers, body);
    if (!verified) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const resource = body?.resource || {};
    const subscriptionId = resource?.id;
    if (!subscriptionId) {
      return res.json({ status: 'ignored' });
    }

    const statusFromResource = resource?.status;
    let status = statusFromResource ? normalizePayPalSubscriptionStatus(statusFromResource) : 'unknown';

    // Fall back to event type mapping if resource.status isn’t present
    const type = String(eventType || '').toUpperCase();
    if (!statusFromResource) {
      if (type === 'BILLING.SUBSCRIPTION.ACTIVATED') status = 'active';
      else if (type === 'BILLING.SUBSCRIPTION.CANCELLED') status = 'canceled';
      else if (type === 'BILLING.SUBSCRIPTION.SUSPENDED') status = 'suspended';
      else if (type === 'BILLING.SUBSCRIPTION.EXPIRED') status = 'expired';
    }

    const nextBilling = resource?.billing_info?.next_billing_time ? new Date(resource.billing_info.next_billing_time) : null;
    const startedAt = resource?.start_time ? new Date(resource.start_time) : null;

    await db.withSystemContext(async (client) => {
      const org = await db.getOrganizationByPayPalSubscriptionId(subscriptionId, client);
      if (!org) return;

      await db.setOrganizationSubscription(
        org.id,
        {
          paypalSubscriptionId: subscriptionId,
          subscriptionStatus: status,
          subscriptionStartedAt: startedAt,
          subscriptionCurrentPeriodEnd: nextBilling,
          billingTier: 'regular'
        },
        client
      );
    });

    res.json({ status: 'ok', eventId, eventType });
  } catch (error) {
    console.error('PayPal billing webhook error:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Capture upgrade requests (UI self-serve > contact sales)
app.post('/api/billing/upgrade-request', authenticateToken, [
  body('plan').optional().isString().trim(),
  body('seats').optional().isInt({ gt: 0 }).withMessage('seats must be a positive integer'),
  body('notes').optional().isString().trim(),
  body('contactEmail').optional().isEmail().withMessage('contactEmail must be valid'),
  body('contactName').optional().isString().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Invalid token structure' });

    let organizationId = req.user?.organizationId || null;
    let orgName = req.user?.organizationName || null;
    const dbUser = await authQueries.findUserById(userId);
    organizationId = organizationId || dbUser?.organization_id || null;
    orgName = orgName || dbUser?.organization_name || null;

    await db.setCurrentUserId(userId);

    const { plan, seats, notes, contactEmail, contactName } = req.body;
    const requesterEmail = contactEmail || dbUser?.email || req.user?.email;
    const requesterName = contactName || dbUser?.full_name || dbUser?.username || req.user?.username;

    // Send notification email to admin/sales
    await emailService.sendUpgradeRequestEmail({
      requesterEmail,
      requesterName,
      organizationName: orgName || `Org ${organizationId || 'unknown'}`,
      plan: plan || 'unspecified',
      seats,
      notes
    });

    // Log audit event for traceability
    await db.logAuditEvent('billing', organizationId || userId, 'CREATE', null, {
      type: 'upgrade_request',
      plan: plan || null,
      seats: seats || null,
      notes: notes || null,
      requesterEmail,
      requesterName
    }, {
      userId,
      username: req.user?.username,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    return res.json({ message: 'Upgrade request received' });
  } catch (error) {
    console.error('Error handling upgrade request:', error);
    res.status(500).json({ error: 'Failed to submit upgrade request' });
  }
});

// ============ GRAFANA DASHBOARDS (Embeds per organization) ============

app.get('/api/grafana/dashboards', authenticateToken, async (req, res) => {
  try {
    await ensureGrafanaDashboardsSchema();
    const userId = req.user?.userId ?? req.user?.id;
    let organizationId = req.user?.organizationId || null;
    if (!userId) return res.status(401).json({ error: 'Invalid token structure' });

    if (!organizationId) {
      const dbUser = await authQueries.findUserById(userId);
      organizationId = dbUser?.organization_id || null;
    }

    if (!organizationId) {
      return res.json({ dashboards: [], needsOrganization: true });
    }

    const dashboards = await db.listGrafanaDashboards(organizationId);
    return res.json({ dashboards });
  } catch (error) {
    console.error('Error fetching grafana dashboards:', error);
    res.status(500).json({ error: 'Failed to fetch dashboards' });
  }
});

app.post('/api/grafana/dashboards', authenticateToken, requireAdmin, [
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Name is required'),
  body('embedUrl').trim().isLength({ min: 1 }).withMessage('embedUrl is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    await ensureGrafanaDashboardsSchema();
    const userId = req.user?.userId ?? req.user?.id;
    let organizationId = req.user?.organizationId || null;
    if (!userId) return res.status(401).json({ error: 'Invalid token structure' });

    if (!organizationId) {
      const dbUser = await authQueries.findUserById(userId);
      organizationId = dbUser?.organization_id || null;
    }

    if (!organizationId) {
      return res.status(409).json({ error: 'Create or join an organization first' });
    }

    const { name, description, embedUrl } = req.body;
    console.log('[Grafana URL Check] embedUrl:', embedUrl, 'isAllowed:', isAllowedGrafanaUrl(embedUrl));
    if (!isAllowedGrafanaUrl(embedUrl)) {
      console.log('[Grafana URL Check] Allowed hosts:', parseAllowedGrafanaHosts());
      return res.status(400).json({ error: 'Embed URL host not allowed. Set GRAFANA_ALLOWED_HOSTS.' });
    }

    const dashboard = await db.createGrafanaDashboard(organizationId, {
      name: name.trim(),
      description: description?.trim() || null,
      embedUrl: embedUrl.trim(),
      createdBy: userId
    });

    return res.status(201).json({ dashboard });
  } catch (error) {
    console.error('Error creating grafana dashboard:', error);
    res.status(500).json({ error: 'Failed to create dashboard' });
  }
});

app.put('/api/grafana/dashboards/:id', authenticateToken, requireAdmin, [
  body('name').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Name must be 1-255 chars'),
  body('embedUrl').optional().trim().isLength({ min: 1 }).withMessage('embedUrl is required when provided')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    await ensureGrafanaDashboardsSchema();
    const userId = req.user?.userId ?? req.user?.id;
    let organizationId = req.user?.organizationId || null;
    if (!userId) return res.status(401).json({ error: 'Invalid token structure' });

    if (!organizationId) {
      const dbUser = await authQueries.findUserById(userId);
      organizationId = dbUser?.organization_id || null;
    }

    if (!organizationId) {
      return res.status(409).json({ error: 'Create or join an organization first' });
    }

    const { name, description, embedUrl } = req.body;
    if (embedUrl && !isAllowedGrafanaUrl(embedUrl)) {
      return res.status(400).json({ error: 'Embed URL host not allowed. Set GRAFANA_ALLOWED_HOSTS.' });
    }

    const updated = await db.updateGrafanaDashboard(organizationId, Number(req.params.id), {
      name: name?.trim() || null,
      description: description?.trim() || null,
      embedUrl: embedUrl?.trim() || null
    });

    if (!updated) return res.status(404).json({ error: 'Dashboard not found' });
    return res.json({ dashboard: updated });
  } catch (error) {
    console.error('Error updating grafana dashboard:', error);
    res.status(500).json({ error: 'Failed to update dashboard' });
  }
});

app.delete('/api/grafana/dashboards/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensureGrafanaDashboardsSchema();
    const userId = req.user?.userId ?? req.user?.id;
    let organizationId = req.user?.organizationId || null;
    if (!userId) return res.status(401).json({ error: 'Invalid token structure' });

    if (!organizationId) {
      const dbUser = await authQueries.findUserById(userId);
      organizationId = dbUser?.organization_id || null;
    }

    if (!organizationId) {
      return res.status(409).json({ error: 'Create or join an organization first' });
    }

    const deleted = await db.deleteGrafanaDashboard(organizationId, Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Dashboard not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting grafana dashboard:', error);
    res.status(500).json({ error: 'Failed to delete dashboard' });
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
    res.status(500).json(safeError(error));
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
    res.status(500).json(safeError(error));
  }
});

// ============ CONSUMABLES ENDPOINTS ============

// Get all consumables
app.get('/api/consumables', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    const consumables = await consumablesDb.getAllConsumables();
    res.json(consumables);
  } catch (error) {
    console.error('Error fetching consumables:', error);
    if (error?.code === '42P01') {
      let dbInfo = null;
      let schemaInfo = null;
      try { dbInfo = await db.getDbSessionInfo(); } catch {}
      try { schemaInfo = await db.getConsumablesSchemaDiagnostics(); } catch {}
      return res.status(500).json({
        error: 'Consumables tables not found. Apply migration.',
        code: 'MISSING_CONSUMABLES_TABLE',
        fix: 'Run: node itam-saas/Agent/migrations/run-consumables-migration.js',
        db: dbInfo || undefined,
        schema: schemaInfo || undefined
      });
    }
    res.status(500).json({ error: 'Failed to fetch consumables' });
  }
});

// Get low stock items
app.get('/api/consumables/low-stock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    const lowStockItems = await consumablesDb.getLowStockItems();
    res.json(lowStockItems);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

// Get single consumable
app.get('/api/consumables/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    const consumable = await consumablesDb.getConsumableById(req.params.id);
    if (!consumable) {
      return res.status(404).json({ error: 'Consumable not found' });
    }
    res.json(consumable);
  } catch (error) {
    console.error('Error fetching consumable:', error);
    res.status(500).json({ error: 'Failed to fetch consumable' });
  }
});

// Create consumable
app.post('/api/consumables', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    const payload = { ...req.body, user_id: req.user.userId };
    const consumable = await consumablesDb.createConsumable(payload);
    res.status(201).json(consumable);
  } catch (error) {
    console.error('Error creating consumable:', error);
    if (error?.code === '42P01') {
      let dbInfo = null;
      let schemaInfo = null;
      try { dbInfo = await db.getDbSessionInfo(); } catch {}
      try { schemaInfo = await db.getConsumablesSchemaDiagnostics(); } catch {}
      return res.status(500).json({
        error: 'Consumables tables not found. Apply migration.',
        code: 'MISSING_CONSUMABLES_TABLE',
        fix: 'Run: node itam-saas/Agent/migrations/run-consumables-migration.js',
        db: dbInfo || undefined,
        schema: schemaInfo || undefined
      });
    }
    res.status(500).json({ error: 'Failed to create consumable' });
  }
});

// Update consumable
app.put('/api/consumables/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    const consumable = await consumablesDb.updateConsumable(req.params.id, req.body);
    if (!consumable) {
      return res.status(404).json({ error: 'Consumable not found' });
    }
    res.json(consumable);
  } catch (error) {
    console.error('Error updating consumable:', error);
    res.status(500).json({ error: 'Failed to update consumable' });
  }
});

// Delete consumable
app.delete('/api/consumables/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    const consumable = await consumablesDb.deleteConsumable(req.params.id);
    if (!consumable) {
      return res.status(404).json({ error: 'Consumable not found' });
    }
    res.json({ message: 'Consumable deleted successfully' });
  } catch (error) {
    console.error('Error deleting consumable:', error);
    res.status(500).json({ error: 'Failed to delete consumable' });
  }
});

// Adjust stock
app.post('/api/consumables/:id/adjust', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    const { quantity, reason } = req.body;
    
    if (!quantity || quantity === 0) {
      return res.status(400).json({ error: 'Quantity is required' });
    }
    
    const consumable = await consumablesDb.adjustStock(
      req.params.id,
      parseInt(quantity),
      reason,
      req.user.userId,
      req.user.username,
      req.user.userId
    );
    res.json(consumable);
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.status(500).json({ error: error.message || 'Failed to adjust stock' });
  }
});

// Get transaction history
app.get('/api/consumables/:id/transactions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.setCurrentUserId(req.user.userId);
    const transactions = await consumablesDb.getConsumableTransactions(req.params.id);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Initialize and start server
startServer();

// Global error handler (must be after routes)
// Ensures unexpected errors return JSON and include request correlation id.
app.use((err, req, res, next) => {
  const requestId = req?.requestId || 'unknown';
  console.error(`[${new Date().toISOString()}] [${requestId}] Unhandled error:`, err);
  
  // Record error for crash detection
  recordError(err, { requestId, url: req?.url, method: req?.method });
  
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
  stopLicenseExpirationChecker(global.licenseCheckerInterval);
  clearInterval(global.metricsInterval);
  clearInterval(global.memoryCheckInterval);
  await shutdownAlertService();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  stopLicenseExpirationChecker(global.licenseCheckerInterval);
  clearInterval(global.metricsInterval);
  clearInterval(global.memoryCheckInterval);
  await shutdownAlertService();
  process.exit(0);
});

// Start listening (both production and development)
httpServer.listen(PORT, () => {
  const host = process.env.RAILWAY_PUBLIC_DOMAIN || `localhost:${PORT}`;
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  
  console.log(`\n🚀 IT Asset Tracker Server running on ${protocol}://${host}`);
  console.log(`📊 API available at ${protocol}://${host}/api`);
  console.log(`🏥 Health check: ${protocol}://${host}/health`);
  console.log(`📈 Prometheus metrics: ${protocol}://${host}/metrics`);
  console.log(`🔌 WebSocket ready for real-time alerts\n`);
});
