import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@itasset.local';
const ALERT_EMAIL = process.env.ALERT_EMAIL || process.env.HEALTH_CHECK_EMAIL || 'tjh852321@gmail.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://it-asset-project.vercel.app';
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN || 'it-asset-project-production.up.railway.app';

// Track startup metrics
let startupCount = 0;
let lastStartupTime = null;
let startupHistory = [];
let errorHistory = [];

// Crash detection thresholds
const CRASH_THRESHOLDS = {
  MAX_RESTARTS_PER_HOUR: 3,
  MAX_RESTARTS_PER_5_MIN: 2,
  MIN_UPTIME_SECONDS: 30, // If server dies within 30s, it's a crash
  ERROR_HISTORY_LIMIT: 50
};

// Common crash patterns and their fixes
const CRASH_PATTERNS = {
  'ECONNREFUSED': {
    cause: 'Database connection refused',
    fixes: [
      'Check if PostgreSQL is running',
      'Verify DATABASE_URL is correct',
      'Check if database host is reachable',
      'Verify Railway private networking is enabled'
    ]
  },
  'ENOTFOUND': {
    cause: 'DNS resolution failed for database host',
    fixes: [
      'Check DATABASE_URL hostname spelling',
      'Verify network connectivity',
      'Use internal Railway hostname for internal connections'
    ]
  },
  'ETIMEDOUT': {
    cause: 'Database connection timeout',
    fixes: [
      'Database may be overloaded',
      'Check connection pool settings',
      'Verify firewall rules allow connection',
      'Consider increasing connection timeout'
    ]
  },
  'pool.query is not a function': {
    cause: 'Database pool not properly initialized',
    fixes: [
      'Check db.js exports',
      'Verify pool is exported as default',
      'Restart the service'
    ]
  },
  'JWT_SECRET': {
    cause: 'JWT secret not configured',
    fixes: [
      'Set JWT_SECRET environment variable',
      'Ensure .env file is loaded',
      'Check Railway environment variables'
    ]
  },
  'SIGTERM': {
    cause: 'Process terminated by Railway (deployment or scaling)',
    fixes: [
      'Normal during deployments - no action needed',
      'If frequent, check Railway logs for OOM kills',
      'Consider increasing memory allocation'
    ]
  },
  'SIGKILL': {
    cause: 'Process forcefully killed (likely OOM)',
    fixes: [
      'Increase memory allocation in Railway',
      'Check for memory leaks',
      'Review connection pool sizes',
      'Add memory monitoring'
    ]
  },
  'heap out of memory': {
    cause: 'JavaScript heap memory exhausted',
    fixes: [
      'Increase NODE_OPTIONS --max-old-space-size',
      'Fix memory leaks in application',
      'Review large data processing operations',
      'Add pagination to large queries'
    ]
  },
  'EADDRINUSE': {
    cause: 'Port already in use',
    fixes: [
      'Previous process did not shut down cleanly',
      'Check for zombie processes',
      'Wait for port to be released'
    ]
  },
  'MODULE_NOT_FOUND': {
    cause: 'Missing npm package',
    fixes: [
      'Run npm install',
      'Check package.json dependencies',
      'Verify node_modules is installed'
    ]
  },
  'SyntaxError': {
    cause: 'JavaScript syntax error in code',
    fixes: [
      'Check recent code changes',
      'Run npm run lint',
      'Review the stack trace for file location'
    ]
  },
  'relation .* does not exist': {
    cause: 'Database table or view missing',
    fixes: [
      'Run database migrations',
      'Check if table was dropped',
      'Verify database connection is to correct database'
    ]
  },
  'column .* does not exist': {
    cause: 'Database column missing from query',
    fixes: [
      'Run database migrations',
      'Check SQL query for typos',
      'Verify schema matches code expectations'
    ]
  }
};

/**
 * Record a server startup
 */
export function recordStartup() {
  const now = new Date();
  startupCount++;
  
  // Calculate uptime since last startup
  const uptimeSeconds = lastStartupTime 
    ? Math.floor((now - lastStartupTime) / 1000)
    : null;
  
  const startupRecord = {
    timestamp: now.toISOString(),
    startupNumber: startupCount,
    previousUptime: uptimeSeconds,
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development'
  };
  
  startupHistory.push(startupRecord);
  
  // Keep only last 20 startups
  if (startupHistory.length > 20) {
    startupHistory = startupHistory.slice(-20);
  }
  
  lastStartupTime = now;
  
  // Check for crash patterns
  checkForCrashPattern(startupRecord);
  
  // Log to database
  logStartupToDatabase(startupRecord);
  
  return startupRecord;
}

/**
 * Record an error
 */
export function recordError(error, context = {}) {
  const errorRecord = {
    timestamp: new Date().toISOString(),
    message: error.message || String(error),
    stack: error.stack,
    code: error.code,
    context,
    memoryUsage: process.memoryUsage()
  };
  
  errorHistory.push(errorRecord);
  
  // Keep only recent errors
  if (errorHistory.length > CRASH_THRESHOLDS.ERROR_HISTORY_LIMIT) {
    errorHistory = errorHistory.slice(-CRASH_THRESHOLDS.ERROR_HISTORY_LIMIT);
  }
  
  // Analyze and potentially alert
  analyzeError(errorRecord);
  
  return errorRecord;
}

/**
 * Check for crash patterns based on startup history
 */
async function checkForCrashPattern(currentStartup) {
  const now = new Date();
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const fiveMinAgo = new Date(now - 5 * 60 * 1000);
  
  // Count recent restarts
  const restartsLastHour = startupHistory.filter(
    s => new Date(s.timestamp) > oneHourAgo
  ).length;
  
  const restartsLast5Min = startupHistory.filter(
    s => new Date(s.timestamp) > fiveMinAgo
  ).length;
  
  // Check for crash loop (very short uptime)
  const isCrashLoop = currentStartup.previousUptime !== null && 
    currentStartup.previousUptime < CRASH_THRESHOLDS.MIN_UPTIME_SECONDS;
  
  // Determine if we should alert
  let shouldAlert = false;
  let alertReason = '';
  let severity = 'warning';
  
  if (isCrashLoop) {
    shouldAlert = true;
    alertReason = `Crash loop detected! Server died after only ${currentStartup.previousUptime} seconds`;
    severity = 'critical';
  } else if (restartsLast5Min >= CRASH_THRESHOLDS.MAX_RESTARTS_PER_5_MIN) {
    shouldAlert = true;
    alertReason = `${restartsLast5Min} restarts in the last 5 minutes`;
    severity = 'critical';
  } else if (restartsLastHour >= CRASH_THRESHOLDS.MAX_RESTARTS_PER_HOUR) {
    shouldAlert = true;
    alertReason = `${restartsLastHour} restarts in the last hour`;
    severity = 'warning';
  }
  
  if (shouldAlert) {
    await sendCrashAlert({
      reason: alertReason,
      severity,
      startupHistory: startupHistory.slice(-5),
      errorHistory: errorHistory.slice(-10),
      metrics: {
        totalStartups: startupCount,
        restartsLastHour,
        restartsLast5Min,
        memoryUsage: currentStartup.memoryUsage
      }
    });
  }
  
  console.log(`📊 Crash Detection: Startup #${startupCount}, ${restartsLastHour} restarts/hour, ${restartsLast5Min} restarts/5min${isCrashLoop ? ' [CRASH LOOP]' : ''}`);
}

/**
 * Analyze an error and determine potential fixes
 */
function analyzeError(errorRecord) {
  const errorStr = `${errorRecord.message} ${errorRecord.stack || ''} ${errorRecord.code || ''}`;
  
  for (const [pattern, info] of Object.entries(CRASH_PATTERNS)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(errorStr)) {
      errorRecord.analysis = {
        pattern,
        cause: info.cause,
        suggestedFixes: info.fixes
      };
      console.log(`🔍 Error Analysis: ${info.cause}`);
      console.log(`   Suggested fixes: ${info.fixes.join(', ')}`);
      return;
    }
  }
}

/**
 * Send crash alert email
 */
async function sendCrashAlert(data) {
  const { reason, severity, startupHistory, errorHistory, metrics } = data;
  
  console.log(`🚨 Crash Alert [${severity.toUpperCase()}]: ${reason}`);
  
  // Try to identify the cause from error history
  let identifiedCause = 'Unknown';
  let suggestedFixes = ['Check Railway logs for more details', 'Review recent code changes'];
  
  for (const error of errorHistory.reverse()) {
    if (error.analysis) {
      identifiedCause = error.analysis.cause;
      suggestedFixes = error.analysis.suggestedFixes;
      break;
    }
  }
  
  // Format startup history for email
  const startupTable = startupHistory.map(s => 
    `<tr>
      <td style="padding: 8px; border: 1px solid #374151;">${s.timestamp}</td>
      <td style="padding: 8px; border: 1px solid #374151;">#${s.startupNumber}</td>
      <td style="padding: 8px; border: 1px solid #374151;">${s.previousUptime !== null ? `${s.previousUptime}s` : 'N/A'}</td>
      <td style="padding: 8px; border: 1px solid #374151;">${Math.round(s.memoryUsage.heapUsed / 1024 / 1024)}MB</td>
    </tr>`
  ).join('');
  
  // Format error history for email
  const errorList = errorHistory.slice(-5).map(e =>
    `<li style="margin: 10px 0; padding: 10px; background: #1f2937; border-radius: 4px;">
      <strong>${e.timestamp}</strong><br>
      <code style="color: #ef4444;">${e.message}</code>
      ${e.analysis ? `<br><em style="color: #fbbf24;">Cause: ${e.analysis.cause}</em>` : ''}
    </li>`
  ).join('');
  
  // Build email HTML
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #111827; color: #f9fafb; padding: 20px; border-radius: 8px;">
      <h1 style="color: ${severity === 'critical' ? '#ef4444' : '#f59e0b'}; margin-bottom: 20px;">
        🚨 ${severity === 'critical' ? 'CRITICAL' : 'WARNING'}: Server Crash Detected
      </h1>
      
      <div style="background: #1f2937; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <h2 style="color: #60a5fa; margin-top: 0;">Alert Details</h2>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'production'}</p>
        <p><strong>Service:</strong> <a href="https://${RAILWAY_URL}" style="color: #60a5fa;">${RAILWAY_URL}</a></p>
      </div>
      
      <div style="background: #1f2937; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <h2 style="color: #f59e0b; margin-top: 0;">🔍 Root Cause Analysis</h2>
        <p><strong>Identified Cause:</strong> ${identifiedCause}</p>
        <h3 style="color: #10b981;">Suggested Fixes:</h3>
        <ol style="padding-left: 20px;">
          ${suggestedFixes.map(fix => `<li style="margin: 5px 0;">${fix}</li>`).join('')}
        </ol>
      </div>
      
      <div style="background: #1f2937; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <h2 style="color: #60a5fa; margin-top: 0;">📊 Metrics</h2>
        <ul style="list-style: none; padding: 0;">
          <li>Total Startups This Session: <strong>${metrics.totalStartups}</strong></li>
          <li>Restarts Last Hour: <strong style="color: ${metrics.restartsLastHour >= 3 ? '#ef4444' : '#10b981'};">${metrics.restartsLastHour}</strong></li>
          <li>Restarts Last 5 Min: <strong style="color: ${metrics.restartsLast5Min >= 2 ? '#ef4444' : '#10b981'};">${metrics.restartsLast5Min}</strong></li>
          <li>Current Heap Used: <strong>${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB</strong></li>
          <li>Heap Total: <strong>${Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024)}MB</strong></li>
        </ul>
      </div>
      
      <div style="background: #1f2937; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <h2 style="color: #60a5fa; margin-top: 0;">📜 Recent Startup History</h2>
        <table style="width: 100%; border-collapse: collapse; color: #f9fafb;">
          <thead>
            <tr style="background: #374151;">
              <th style="padding: 8px; border: 1px solid #4b5563;">Time</th>
              <th style="padding: 8px; border: 1px solid #4b5563;">Startup #</th>
              <th style="padding: 8px; border: 1px solid #4b5563;">Prev Uptime</th>
              <th style="padding: 8px; border: 1px solid #4b5563;">Memory</th>
            </tr>
          </thead>
          <tbody>
            ${startupTable}
          </tbody>
        </table>
      </div>
      
      ${errorList ? `
      <div style="background: #1f2937; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <h2 style="color: #ef4444; margin-top: 0;">❌ Recent Errors</h2>
        <ul style="list-style: none; padding: 0;">
          ${errorList}
        </ul>
      </div>
      ` : ''}
      
      <div style="background: #1e3a5f; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <h2 style="color: #60a5fa; margin-top: 0;">🛠️ Quick Actions</h2>
        <ul style="padding-left: 20px;">
          <li><a href="https://railway.app/dashboard" style="color: #60a5fa;">Check Railway Dashboard</a></li>
          <li><a href="https://${RAILWAY_URL}/health" style="color: #60a5fa;">Health Check Endpoint</a></li>
          <li><a href="${FRONTEND_URL}" style="color: #60a5fa;">Frontend Status</a></li>
        </ul>
      </div>
      
      <hr style="border: none; border-top: 1px solid #374151; margin: 20px 0;">
      <p style="color: #6b7280; font-size: 12px; text-align: center;">
        IT Asset Tracker Crash Detection System<br>
        Auto-generated alert - Do not reply
      </p>
    </div>
  `;
  
  // Log to database
  try {
    await pool.query(`
      INSERT INTO crash_logs (severity, reason, cause, fixes, metrics, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [severity, reason, identifiedCause, JSON.stringify(suggestedFixes), JSON.stringify(metrics)]);
  } catch (dbErr) {
    console.warn('Could not log crash to database:', dbErr.message);
  }
  
  // Send email
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY not configured, crash alert not sent via email');
    console.log('📧 Would have sent to:', ALERT_EMAIL);
    return null;
  }
  
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ALERT_EMAIL,
      subject: `🚨 [${severity.toUpperCase()}] Server Crash - IT Asset Tracker`,
      html: emailHtml
    });
    
    if (error) {
      console.error('❌ Failed to send crash alert email:', error);
      return null;
    }
    
    console.log('✅ Crash alert email sent to:', ALERT_EMAIL);
    return data;
  } catch (err) {
    console.error('❌ Error sending crash alert:', err);
    return null;
  }
}

/**
 * Set up global error handlers
 */
export function setupCrashHandlers() {
  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('💥 UNCAUGHT EXCEPTION:', error);
    recordError(error, { type: 'uncaughtException' });
    
    // Send alert synchronously before crashing
    sendCrashAlert({
      reason: `Uncaught Exception: ${error.message}`,
      severity: 'critical',
      startupHistory: startupHistory.slice(-5),
      errorHistory: errorHistory.slice(-10),
      metrics: {
        totalStartups: startupCount,
        restartsLastHour: startupHistory.filter(s => 
          new Date(s.timestamp) > new Date(Date.now() - 60 * 60 * 1000)
        ).length,
        restartsLast5Min: startupHistory.filter(s => 
          new Date(s.timestamp) > new Date(Date.now() - 5 * 60 * 1000)
        ).length,
        memoryUsage: process.memoryUsage()
      }
    }).finally(() => {
      // Exit after sending alert
      process.exit(1);
    });
  });
  
  // Unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION:', reason);
    recordError(reason instanceof Error ? reason : new Error(String(reason)), { 
      type: 'unhandledRejection',
      promise: String(promise)
    });
  });
  
  // Memory warnings - use RSS (actual memory usage) instead of heap percentage
  // Railway containers typically have 512MB-1GB, warn at 400MB
  const MEMORY_WARNING_THRESHOLD_MB = 400;
  const memoryCheckInterval = setInterval(() => {
    const usage = process.memoryUsage();
    const rssMB = usage.rss / 1024 / 1024;
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    
    // Only warn if RSS exceeds threshold (actual memory pressure)
    if (rssMB > MEMORY_WARNING_THRESHOLD_MB) {
      console.warn(`⚠️ HIGH MEMORY USAGE: RSS ${rssMB.toFixed(0)}MB (Heap: ${heapUsedMB.toFixed(0)}MB)`);
      recordError(new Error(`High memory usage: RSS ${rssMB.toFixed(0)}MB`), {
        type: 'memoryWarning',
        rssMB,
        heapUsedMB,
        threshold: MEMORY_WARNING_THRESHOLD_MB
      });
    }
  }, 300000); // Check every 5 minutes (less noisy)
  
  // Store interval for cleanup
  global.memoryCheckInterval = memoryCheckInterval;
  
  console.log('✅ Crash detection handlers installed');
}

/**
 * Log startup to database
 */
async function logStartupToDatabase(record) {
  try {
    // Create crash_logs table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crash_logs (
        id SERIAL PRIMARY KEY,
        severity VARCHAR(20),
        reason TEXT,
        cause TEXT,
        fixes JSONB,
        metrics JSONB,
        startup_record JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create startup_logs table if it doesn't exist  
    await pool.query(`
      CREATE TABLE IF NOT EXISTS startup_logs (
        id SERIAL PRIMARY KEY,
        startup_number INTEGER,
        previous_uptime INTEGER,
        node_version VARCHAR(50),
        memory_heap_used BIGINT,
        memory_heap_total BIGINT,
        environment VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await pool.query(`
      INSERT INTO startup_logs (startup_number, previous_uptime, node_version, memory_heap_used, memory_heap_total, environment, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      record.startupNumber,
      record.previousUptime,
      record.nodeVersion,
      record.memoryUsage.heapUsed,
      record.memoryUsage.heapTotal,
      record.env,
      record.timestamp
    ]);
  } catch (err) {
    console.warn('Could not log startup to database:', err.message);
  }
}

/**
 * Get crash statistics
 */
export function getCrashStats() {
  const now = new Date();
  const oneHourAgo = new Date(now - 60 * 60 * 1000);
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  
  return {
    currentUptime: lastStartupTime ? Math.floor((now - lastStartupTime) / 1000) : 0,
    totalStartups: startupCount,
    restartsLastHour: startupHistory.filter(s => new Date(s.timestamp) > oneHourAgo).length,
    restartsLastDay: startupHistory.filter(s => new Date(s.timestamp) > oneDayAgo).length,
    recentErrors: errorHistory.slice(-5),
    startupHistory: startupHistory.slice(-10),
    memoryUsage: process.memoryUsage()
  };
}

/**
 * Get crash logs from database
 */
export async function getCrashLogsFromDb(limit = 20) {
  try {
    const result = await pool.query(`
      SELECT * FROM crash_logs 
      ORDER BY created_at DESC 
      LIMIT $1
    `, [limit]);
    return result.rows;
  } catch {
    return [];
  }
}

/**
 * Get startup logs from database
 */
export async function getStartupLogsFromDb(limit = 50) {
  try {
    const result = await pool.query(`
      SELECT * FROM startup_logs 
      ORDER BY created_at DESC 
      LIMIT $1
    `, [limit]);
    return result.rows;
  } catch {
    return [];
  }
}

export default {
  recordStartup,
  recordError,
  setupCrashHandlers,
  getCrashStats,
  getCrashLogsFromDb,
  getStartupLogsFromDb
};
