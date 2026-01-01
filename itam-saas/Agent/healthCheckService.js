import { Resend } from 'resend';
import { getPool } from './queries.js';
import { getRedisClient } from './redis.js';

// Configuration
const HEALTH_CHECK_EMAIL = process.env.HEALTH_CHECK_EMAIL || 'tjh852321@gmail.com';
const HEALTH_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

// Services to monitor
const SERVICES = {
  backend: {
    name: 'API Backend',
    url: 'https://it-asset-project-production.up.railway.app/health',
    type: 'http'
  },
  frontend: {
    name: 'Frontend (Vercel)',
    url: 'https://it-asset-project.vercel.app',
    type: 'http'
  },
  grafana: {
    name: 'Grafana Dashboard',
    url: 'https://grafana-production-f114.up.railway.app/api/health',
    type: 'http'
  },
  database: {
    name: 'PostgreSQL Database',
    type: 'database'
  },
  redis: {
    name: 'Redis Cache',
    type: 'redis'
  }
};

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Check HTTP service health
 */
async function checkHttpService(url, timeout = 10000) {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'ITAM-HealthCheck/1.0' }
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    return {
      status: response.ok ? 'healthy' : 'degraded',
      statusCode: response.status,
      responseTime,
      message: response.ok ? 'Service responding' : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      statusCode: null,
      responseTime: Date.now() - startTime,
      message: error.name === 'AbortError' ? 'Timeout' : error.message
    };
  }
}

/**
 * Check PostgreSQL database health
 */
async function checkDatabaseHealth() {
  const startTime = Date.now();
  try {
    const pool = getPool();
    const result = await pool.query('SELECT NOW() as time, pg_database_size(current_database()) as db_size');
    const responseTime = Date.now() - startTime;
    
    const dbSizeMB = Math.round(result.rows[0].db_size / (1024 * 1024));
    
    // Get connection stats
    const connResult = await pool.query(`
      SELECT count(*) as total, 
             sum(case when state = 'active' then 1 else 0 end) as active,
             sum(case when state = 'idle' then 1 else 0 end) as idle
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    
    // Get table counts
    const tableResult = await pool.query(`
      SELECT 
        (SELECT count(*) FROM assets) as assets_count,
        (SELECT count(*) FROM auth_users) as users_count,
        (SELECT count(*) FROM licenses) as licenses_count,
        (SELECT count(*) FROM organizations) as orgs_count
    `);
    
    return {
      status: 'healthy',
      responseTime,
      message: 'Database connected',
      details: {
        dbSizeMB,
        connections: {
          total: parseInt(connResult.rows[0].total),
          active: parseInt(connResult.rows[0].active),
          idle: parseInt(connResult.rows[0].idle)
        },
        records: {
          assets: parseInt(tableResult.rows[0].assets_count),
          users: parseInt(tableResult.rows[0].users_count),
          licenses: parseInt(tableResult.rows[0].licenses_count),
          organizations: parseInt(tableResult.rows[0].orgs_count)
        }
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error.message,
      details: null
    };
  }
}

/**
 * Check Redis health
 */
async function checkRedisHealth() {
  const startTime = Date.now();
  try {
    const redis = await getRedisClient();
    if (!redis) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        message: 'Redis client not available'
      };
    }
    
    // Ping Redis
    await redis.ping();
    
    // Get memory info
    const info = await redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const usedMemory = memoryMatch ? memoryMatch[1] : 'unknown';
    
    // Get key count
    const dbSize = await redis.dbSize();
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime,
      message: 'Redis connected',
      details: {
        usedMemory,
        keyCount: dbSize
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error.message,
      details: null
    };
  }
}

/**
 * Run all health checks
 */
export async function runHealthChecks() {
  console.log('🏥 Running health checks...');
  const results = {};
  const startTime = new Date();
  
  for (const [key, service] of Object.entries(SERVICES)) {
    console.log(`  Checking ${service.name}...`);
    
    if (service.type === 'http') {
      results[key] = await checkHttpService(service.url);
    } else if (service.type === 'database') {
      results[key] = await checkDatabaseHealth();
    } else if (service.type === 'redis') {
      results[key] = await checkRedisHealth();
    }
    
    results[key].name = service.name;
    results[key].url = service.url || null;
  }
  
  // Calculate overall status
  const statuses = Object.values(results).map(r => r.status);
  let overallStatus = 'healthy';
  if (statuses.includes('unhealthy')) {
    overallStatus = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    overallStatus = 'degraded';
  }
  
  const report = {
    timestamp: startTime.toISOString(),
    overallStatus,
    services: results,
    summary: {
      healthy: statuses.filter(s => s === 'healthy').length,
      degraded: statuses.filter(s => s === 'degraded').length,
      unhealthy: statuses.filter(s => s === 'unhealthy').length,
      total: statuses.length
    }
  };
  
  console.log(`🏥 Health check complete: ${overallStatus} (${report.summary.healthy}/${report.summary.total} healthy)`);
  
  return report;
}

/**
 * Generate HTML email report
 */
function generateHealthReportEmail(report) {
  const statusColors = {
    healthy: '#22c55e',
    degraded: '#f59e0b',
    unhealthy: '#ef4444'
  };
  
  const statusEmojis = {
    healthy: '✅',
    degraded: '⚠️',
    unhealthy: '❌'
  };
  
  const serviceRows = Object.entries(report.services).map(([key, service]) => {
    const color = statusColors[service.status];
    const emoji = statusEmojis[service.status];
    
    let detailsHtml = '';
    if (service.details) {
      if (service.details.connections) {
        detailsHtml = `
          <br><small style="color: #666;">
            DB: ${service.details.dbSizeMB}MB | 
            Connections: ${service.details.connections.active} active / ${service.details.connections.total} total<br>
            Records: ${service.details.records.assets} assets, ${service.details.records.users} users, ${service.details.records.organizations} orgs
          </small>
        `;
      } else if (service.details.keyCount !== undefined) {
        detailsHtml = `
          <br><small style="color: #666;">
            Memory: ${service.details.usedMemory} | Keys: ${service.details.keyCount}
          </small>
        `;
      }
    }
    
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <strong>${service.name}</strong>
          ${service.url ? `<br><small style="color: #999;">${service.url}</small>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="color: ${color}; font-weight: bold;">${emoji} ${service.status.toUpperCase()}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${service.responseTime}ms
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${service.message}${detailsHtml}
        </td>
      </tr>
    `;
  }).join('');
  
  const overallColor = statusColors[report.overallStatus];
  const overallEmoji = statusEmojis[report.overallStatus];
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>IT Asset Tracker - Health Check Report</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        
        <h1 style="color: #1f2937; margin-bottom: 5px;">🏥 Health Check Report</h1>
        <p style="color: #6b7280; margin-top: 0;">IT Asset Tracker - Daily System Status</p>
        
        <div style="background-color: ${overallColor}15; border-left: 4px solid ${overallColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h2 style="margin: 0; color: ${overallColor};">
            ${overallEmoji} Overall Status: ${report.overallStatus.toUpperCase()}
          </h2>
          <p style="margin: 5px 0 0 0; color: #666;">
            ${report.summary.healthy}/${report.summary.total} services healthy
            ${report.summary.degraded > 0 ? ` | ${report.summary.degraded} degraded` : ''}
            ${report.summary.unhealthy > 0 ? ` | ${report.summary.unhealthy} unhealthy` : ''}
          </p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Service</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Status</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Response</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Details</th>
            </tr>
          </thead>
          <tbody>
            ${serviceRows}
          </tbody>
        </table>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          Report generated at ${new Date(report.timestamp).toLocaleString('en-US', { 
            timeZone: 'UTC',
            dateStyle: 'full',
            timeStyle: 'long'
          })} UTC<br>
          IT Asset Tracker Monitoring System
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send health check report via email
 */
export async function sendHealthCheckEmail(report) {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY not configured, skipping health check email');
    return null;
  }
  
  const html = generateHealthReportEmail(report);
  const statusEmoji = report.overallStatus === 'healthy' ? '✅' : 
                      report.overallStatus === 'degraded' ? '⚠️' : '❌';
  
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: HEALTH_CHECK_EMAIL,
      subject: `${statusEmoji} IT Asset Tracker Health Report - ${report.overallStatus.toUpperCase()}`,
      html
    });
    
    if (error) {
      console.error('❌ Health check email error:', error);
      throw error;
    }
    
    console.log(`✅ Health check email sent to ${HEALTH_CHECK_EMAIL}`);
    return data;
  } catch (error) {
    console.error('❌ Failed to send health check email:', error);
    return null;
  }
}

/**
 * Run health check and send email
 */
export async function runHealthCheckAndNotify() {
  try {
    const report = await runHealthChecks();
    await sendHealthCheckEmail(report);
    return report;
  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    // Try to send error notification
    if (resend) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: HEALTH_CHECK_EMAIL,
          subject: '❌ IT Asset Tracker Health Check FAILED',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2 style="color: #ef4444;">❌ Health Check Failed</h2>
              <p>The health check system encountered an error:</p>
              <pre style="background: #f3f4f6; padding: 15px; border-radius: 4px;">${error.message}</pre>
              <p>Time: ${new Date().toISOString()}</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('❌ Could not send error notification:', emailError);
      }
    }
    
    throw error;
  }
}

/**
 * Start the 24-hour health check scheduler
 */
let healthCheckInterval = null;

export function startHealthCheckScheduler() {
  if (healthCheckInterval) {
    console.log('⚠️ Health check scheduler already running');
    return;
  }
  
  console.log(`📅 Health check scheduler started (every 24 hours)`);
  console.log(`📧 Reports will be sent to: ${HEALTH_CHECK_EMAIL}`);
  
  // Run immediately on startup
  setTimeout(() => {
    runHealthCheckAndNotify().catch(err => {
      console.error('❌ Initial health check failed:', err.message);
    });
  }, 5000); // Wait 5 seconds after startup
  
  // Then run every 24 hours
  healthCheckInterval = setInterval(() => {
    runHealthCheckAndNotify().catch(err => {
      console.error('❌ Scheduled health check failed:', err.message);
    });
  }, HEALTH_CHECK_INTERVAL);
  
  return healthCheckInterval;
}

export function stopHealthCheckScheduler() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('🛑 Health check scheduler stopped');
  }
}

export default {
  runHealthChecks,
  sendHealthCheckEmail,
  runHealthCheckAndNotify,
  startHealthCheckScheduler,
  stopHealthCheckScheduler
};
