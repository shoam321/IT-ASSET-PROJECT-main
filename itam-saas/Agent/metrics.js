/**
 * Prometheus Metrics Module
 * Exposes application metrics for monitoring via Prometheus/Grafana
 * 
 * Prometheus URL: https://railway-prometheus-production-4d7b.up.railway.app/
 */

import client from 'prom-client';

// Create a Registry to hold all metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'itasset_',
  labels: { app: 'it-asset-tracker' }
});

// ========== HTTP Request Metrics ==========

// HTTP request duration histogram
export const httpRequestDuration = new client.Histogram({
  name: 'itasset_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDuration);

// HTTP requests total counter
export const httpRequestsTotal = new client.Counter({
  name: 'itasset_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestsTotal);

// Active HTTP connections gauge
export const activeConnections = new client.Gauge({
  name: 'itasset_active_connections',
  help: 'Number of active HTTP connections'
});
register.registerMetric(activeConnections);

// ========== Business Metrics ==========

// Assets count gauge
export const assetsTotal = new client.Gauge({
  name: 'itasset_assets_total',
  help: 'Total number of assets in the system',
  labelNames: ['status']
});
register.registerMetric(assetsTotal);

// Licenses count gauge
export const licensesTotal = new client.Gauge({
  name: 'itasset_licenses_total',
  help: 'Total number of licenses in the system',
  labelNames: ['status']
});
register.registerMetric(licensesTotal);

// Users count gauge
export const usersTotal = new client.Gauge({
  name: 'itasset_users_total',
  help: 'Total number of users in the system',
  labelNames: ['role']
});
register.registerMetric(usersTotal);

// Organizations count gauge
export const organizationsTotal = new client.Gauge({
  name: 'itasset_organizations_total',
  help: 'Total number of organizations'
});
register.registerMetric(organizationsTotal);

// License expiration metrics
export const licensesExpiringSoon = new client.Gauge({
  name: 'itasset_licenses_expiring_soon',
  help: 'Number of licenses expiring within 30 days'
});
register.registerMetric(licensesExpiringSoon);

// ========== Cache Metrics ==========

// Cache hit/miss counter
export const cacheOperations = new client.Counter({
  name: 'itasset_cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'result'] // operation: get/set, result: hit/miss
});
register.registerMetric(cacheOperations);

// Cache latency histogram
export const cacheLatency = new client.Histogram({
  name: 'itasset_cache_latency_seconds',
  help: 'Cache operation latency in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1]
});
register.registerMetric(cacheLatency);

// ========== Database Metrics ==========

// Database query duration histogram
export const dbQueryDuration = new client.Histogram({
  name: 'itasset_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'], // select, insert, update, delete
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2]
});
register.registerMetric(dbQueryDuration);

// Database connection pool stats
export const dbPoolSize = new client.Gauge({
  name: 'itasset_db_pool_size',
  help: 'Database connection pool size',
  labelNames: ['state'] // total, idle, waiting
});
register.registerMetric(dbPoolSize);

// ========== Authentication Metrics ==========

// Login attempts counter
export const authAttempts = new client.Counter({
  name: 'itasset_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['method', 'result'] // method: password/google, result: success/failure
});
register.registerMetric(authAttempts);

// Active sessions gauge
export const activeSessions = new client.Gauge({
  name: 'itasset_active_sessions',
  help: 'Number of active user sessions'
});
register.registerMetric(activeSessions);

// ========== Payment Metrics ==========

// Subscription events counter
export const subscriptionEvents = new client.Counter({
  name: 'itasset_subscription_events_total',
  help: 'Total subscription events',
  labelNames: ['event_type', 'plan'] // event_type: created/activated/cancelled
});
register.registerMetric(subscriptionEvents);

// Revenue gauge (monthly recurring)
export const monthlyRevenue = new client.Gauge({
  name: 'itasset_monthly_revenue_dollars',
  help: 'Estimated monthly recurring revenue'
});
register.registerMetric(monthlyRevenue);

// ========== Alert Metrics ==========

// Alerts generated counter
export const alertsGenerated = new client.Counter({
  name: 'itasset_alerts_generated_total',
  help: 'Total alerts generated',
  labelNames: ['type', 'severity'] // type: license_expiry/low_stock, severity: info/warning/critical
});
register.registerMetric(alertsGenerated);

// ========== WebSocket Metrics ==========

// Active WebSocket connections
export const websocketConnections = new client.Gauge({
  name: 'itasset_websocket_connections',
  help: 'Number of active WebSocket connections'
});
register.registerMetric(websocketConnections);

// ========== Health Check Metrics ==========

// Health check status gauge (1 = healthy, 0 = unhealthy)
export const healthCheckStatus = new client.Gauge({
  name: 'itasset_health_check_status',
  help: 'Health check status (1=healthy, 0=unhealthy)',
  labelNames: ['service'] // backend, frontend, database, redis, grafana
});
register.registerMetric(healthCheckStatus);

// ========== Middleware for Express ==========

/**
 * Express middleware to track HTTP request metrics
 */
export const metricsMiddleware = (req, res, next) => {
  // Skip metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  activeConnections.inc();
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    activeConnections.dec();
    
    const durationNs = process.hrtime.bigint() - start;
    const durationSeconds = Number(durationNs) / 1e9;

    // Normalize route for label (avoid high cardinality)
    let route = req.route?.path || req.path;
    // Replace IDs with :id placeholder
    route = route.replace(/\/[0-9]+/g, '/:id');
    route = route.replace(/\/[a-f0-9-]{36}/g, '/:uuid');

    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode
    };

    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
  });

  next();
};

/**
 * Update business metrics from database
 * Call this periodically (e.g., every 5 minutes)
 */
export const updateBusinessMetrics = async (pool) => {
  try {
    // Assets by status
    const assetsResult = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM assets 
      GROUP BY status
    `);
    assetsTotal.reset();
    for (const row of assetsResult.rows) {
      assetsTotal.set({ status: row.status || 'unknown' }, parseInt(row.count));
    }

    // Licenses count
    const licensesResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE expiration_date > NOW()) as active,
        COUNT(*) FILTER (WHERE expiration_date <= NOW()) as expired,
        COUNT(*) FILTER (WHERE expiration_date BETWEEN NOW() AND NOW() + INTERVAL '30 days') as expiring_soon
      FROM licenses
    `);
    if (licensesResult.rows[0]) {
      licensesTotal.set({ status: 'active' }, parseInt(licensesResult.rows[0].active) || 0);
      licensesTotal.set({ status: 'expired' }, parseInt(licensesResult.rows[0].expired) || 0);
      licensesExpiringSoon.set(parseInt(licensesResult.rows[0].expiring_soon) || 0);
    }

    // Users by role
    const usersResult = await pool.query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `);
    usersTotal.reset();
    for (const row of usersResult.rows) {
      usersTotal.set({ role: row.role || 'user' }, parseInt(row.count));
    }

    // Organizations count
    const orgsResult = await pool.query('SELECT COUNT(*) as count FROM organizations');
    organizationsTotal.set(parseInt(orgsResult.rows[0]?.count) || 0);

    // Subscriptions for revenue estimate
    const subsResult = await pool.query(`
      SELECT billing_tier, COUNT(*) as count 
      FROM organizations 
      WHERE subscription_status = 'active'
      GROUP BY billing_tier
    `);
    let estimatedRevenue = 0;
    for (const row of subsResult.rows) {
      const tier = row.billing_tier?.toLowerCase();
      const count = parseInt(row.count) || 0;
      if (tier === 'regular' || tier === 'pro') {
        estimatedRevenue += count * 29;
      } else if (tier === 'enterprise') {
        estimatedRevenue += count * 99;
      }
    }
    monthlyRevenue.set(estimatedRevenue);

    console.log('📊 Business metrics updated');
  } catch (error) {
    console.error('Failed to update business metrics:', error.message);
  }
};

/**
 * Update database pool metrics
 */
export const updatePoolMetrics = (pool) => {
  if (pool) {
    dbPoolSize.set({ state: 'total' }, pool.totalCount || 0);
    dbPoolSize.set({ state: 'idle' }, pool.idleCount || 0);
    dbPoolSize.set({ state: 'waiting' }, pool.waitingCount || 0);
  }
};

/**
 * Get the Prometheus registry
 */
export const getMetricsRegistry = () => register;

/**
 * Get metrics in Prometheus format
 */
export const getMetrics = async () => {
  return await register.metrics();
};

/**
 * Get metrics content type
 */
export const getMetricsContentType = () => register.contentType;

export default {
  register,
  metricsMiddleware,
  updateBusinessMetrics,
  updatePoolMetrics,
  getMetrics,
  getMetricsContentType,
  // Export individual metrics for manual updates
  httpRequestDuration,
  httpRequestsTotal,
  activeConnections,
  assetsTotal,
  licensesTotal,
  usersTotal,
  organizationsTotal,
  licensesExpiringSoon,
  cacheOperations,
  cacheLatency,
  dbQueryDuration,
  dbPoolSize,
  authAttempts,
  activeSessions,
  subscriptionEvents,
  monthlyRevenue,
  alertsGenerated,
  websocketConnections,
  healthCheckStatus
};
