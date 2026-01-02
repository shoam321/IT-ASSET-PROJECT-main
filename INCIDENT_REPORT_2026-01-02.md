# Incident Report: Database Tables Lost on Railway

**Date**: January 2, 2026  
**Severity**: Critical  
**Duration**: ~20 minutes  
**Status**: ✅ Resolved  

---

## Executive Summary

The Railway PostgreSQL database lost all tables after a container restart and improper database shutdown. The server failed to start with repeated errors about missing tables (`assets`, `licenses`, `users`, `contracts`, `devices`). Recovery was achieved by running an emergency SQL restore script.

---

## Timeline of Events

| Time (UTC) | Event |
|------------|-------|
| 16:57:38 | Container stopped (`Stopping Container`) |
| 16:57:39 | Volume mount initiated |
| 16:57:39 | **First crash**: `Error: Connection terminated unexpectedly` - Node.js app crashed due to PostgreSQL connection drop |
| 16:57:39 | PostgreSQL logs: `database system was interrupted` |
| 16:57:40 | PostgreSQL recovery: `database system was not properly shut down; automatic recovery in progress` |
| 16:57:40 | PostgreSQL WAL recovery: `redo starts at 0/19159D8` |
| 16:57:40 | PostgreSQL: `database system is ready to accept connections` |
| 16:57:42 | Node.js server starts, begins database init |
| 16:57:43 | **Tables missing**: `⚠️ Assets table not found`, `⚠️ Licenses table not found`, etc. |
| 16:57:43 | Server retries database init (5 attempts, all fail) |
| 16:57:55 | Server starts in degraded mode: `Database initialization failed after retries` |
| 16:59:40 | Agent tries to report usage: `ERROR: relation "devices" does not exist` |
| 17:01:45 | Container restart cycle continues |
| **17:05:00** | **Recovery initiated**: Emergency SQL script executed |
| **17:06:03** | **Recovery complete**: Health check returns `status: ok` |

---

## Root Cause Analysis

### Primary Cause: Improper Database Shutdown

PostgreSQL logs show:
```
database system was interrupted; last known up at 2026-01-02 16:56:11 UTC
database system was not properly shut down; automatic recovery in progress
redo starts at 0/19159D8
invalid record length at 0/1915A10: expected at least 24, got 0
```

The database was not cleanly shut down before the container stopped. PostgreSQL attempted WAL (Write-Ahead Log) recovery but encountered an invalid record, indicating possible:

1. **Volume mount timing issue**: The container was stopped before PostgreSQL could flush data to disk
2. **Signal handling**: `SIGTERM` sent to container before PostgreSQL received graceful shutdown signal
3. **Filesystem corruption**: Volume unmount during active writes

### Secondary Cause: No Auto-Migration

The application's `initDatabase()` function in `queries.js` only **verifies** tables exist but does **not create them**:

```javascript
// queries.js line ~254
if (!assetsExists || !licensesExists || !usersExists || !contractsExists) {
  throw new Error(`Missing tables: assets=${assetsExists}, licenses=${licensesExists}, users=${usersExists}, contracts=${contractsExists}`);
}
```

This design expects tables to pre-exist and fails hard if they don't.

---

## Impact Assessment

| Category | Impact |
|----------|--------|
| **Data Loss** | All table data lost (users, assets, licenses, contracts, devices, usage history) |
| **Service Availability** | Backend API returned 500 errors for ~10 minutes |
| **Agent Connectivity** | Desktop agents received 500 errors, stopped reporting |
| **Frontend** | Dashboard showed errors, users couldn't log in |

---

## Recovery Steps Executed

### Step 1: Diagnosed the Issue
Analyzed Railway logs showing:
- PostgreSQL recovery messages
- Missing table errors
- Server retry loop

### Step 2: Created Emergency Restore Script
Created `EMERGENCY_DB_RESTORE.sql` containing DDL for all 21 tables:

```sql
-- Core tables
CREATE TABLE IF NOT EXISTS auth_users (...)
CREATE TABLE IF NOT EXISTS organizations (...)
CREATE TABLE IF NOT EXISTS assets (...)
CREATE TABLE IF NOT EXISTS licenses (...)
CREATE TABLE IF NOT EXISTS users (...)
CREATE TABLE IF NOT EXISTS contracts (...)

-- Device tracking
CREATE TABLE IF NOT EXISTS devices (...)
CREATE TABLE IF NOT EXISTS device_usage (...)
CREATE TABLE IF NOT EXISTS installed_apps (...)
CREATE TABLE IF NOT EXISTS device_heartbeats (...)

-- Security
CREATE TABLE IF NOT EXISTS forbidden_apps (...)
CREATE TABLE IF NOT EXISTS security_alerts (...)

-- Inventory
CREATE TABLE IF NOT EXISTS consumables (...)
CREATE TABLE IF NOT EXISTS consumable_transactions (...)
CREATE TABLE IF NOT EXISTS low_stock_alerts (...)

-- Supporting tables
CREATE TABLE IF NOT EXISTS locations (...)
CREATE TABLE IF NOT EXISTS employees (...)
CREATE TABLE IF NOT EXISTS asset_categories (...)
CREATE TABLE IF NOT EXISTS grafana_dashboards (...)
CREATE TABLE IF NOT EXISTS receipts (...)
CREATE TABLE IF NOT EXISTS session (...)
```

### Step 3: Executed via Node.js Script
Created `run-emergency-restore.js` to connect to Railway PostgreSQL and execute the SQL:

```bash
node run-emergency-restore.js
```

Output:
```
✅ Connected successfully!
📋 Found 94 SQL statements to execute
✅ Table: auth_users
✅ Table: organizations
... (all 21 tables created)
✅ Successful: 94
❌ Errors: 0
🎉 Database restore complete!
```

### Step 4: Verified Recovery
```powershell
Invoke-RestMethod -Uri "https://it-asset-project-production.up.railway.app/health"
# Result: status: ok
```

---

## Files Created During Recovery

| File | Purpose |
|------|---------|
| `EMERGENCY_DB_RESTORE.sql` | Complete DDL for all 21 tables with indexes and constraints |
| `run-emergency-restore.js` | Node.js script to execute SQL against Railway PostgreSQL |

---

## Data Recovery Status

| Table | Rows Recovered | Notes |
|-------|---------------|-------|
| `auth_users` | 0 | **Data lost** - users must re-register |
| `organizations` | 1 | Default org created |
| `assets` | 0 | **Data lost** |
| `licenses` | 0 | **Data lost** |
| `users` | 0 | **Data lost** |
| `contracts` | 0 | **Data lost** |
| `devices` | 0 | Will auto-populate when agents reconnect |
| `device_usage` | 0 | Historical data lost, new data will accumulate |

---

## Prevention Recommendations

### 1. Enable Auto-Migration (Critical)
Modify `queries.js` to create tables if they don't exist:

```javascript
async function initDatabase() {
  // Instead of just checking, CREATE IF NOT EXISTS
  await pool.query(fs.readFileSync('./init-db.sql', 'utf8'));
  // Then verify
}
```

### 2. Add Database Backup Strategy
```yaml
# Railway cron job or external service
schedule: "0 */6 * * *"  # Every 6 hours
command: pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 3. Implement Graceful Shutdown
```javascript
// server.js
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing connections...');
  await pool.end();
  process.exit(0);
});
```

### 4. Add Health Check with DB Verification
```javascript
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1 FROM assets LIMIT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: err.message });
  }
});
```

### 5. Use Railway's Persistent Volume Correctly
Ensure PostgreSQL data directory is on a persistent volume and container shutdown grace period is adequate:

```toml
# railway.toml
[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
```

---

## Lessons Learned

1. **Always have table creation scripts ready** - The `init-db.sql` and migration files saved recovery time
2. **Monitor for table existence, not just connection** - Health checks should verify schema integrity
3. **Container orchestration can be unpredictable** - PostgreSQL needs graceful shutdown time
4. **Data backups are essential** - No backup = data loss risk

---

## Action Items

| Priority | Action | Owner | Status |
|----------|--------|-------|--------|
| P0 | Restore database tables | System | ✅ Complete |
| P1 | Re-create admin user account | Admin | ⏳ Pending |
| P1 | Notify users to re-register | Admin | ⏳ Pending |
| P2 | Implement auto-migration | Dev | ⏳ Pending |
| P2 | Set up automated backups | DevOps | ⏳ Pending |
| P3 | Add graceful shutdown handling | Dev | ⏳ Pending |

---

## Quick Recovery Commands (For Future Reference)

```bash
# 1. Check database connection
node -e "const pg = require('pg'); const c = new pg.Client(process.env.DATABASE_URL); c.connect().then(() => console.log('OK')).catch(e => console.error(e))"

# 2. Run emergency restore
node run-emergency-restore.js

# 3. Verify tables exist
node -e "const pg = require('pg'); const c = new pg.Client(process.env.DATABASE_URL); c.connect().then(() => c.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema='public'\")).then(r => console.table(r.rows))"

# 4. Check health endpoint
curl https://it-asset-project-production.up.railway.app/health
```

---

**Report Generated**: 2026-01-02T17:10:00Z  
**Next Review**: Implement prevention measures within 7 days
