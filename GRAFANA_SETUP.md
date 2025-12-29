# Grafana Setup Guide

## Overview
Grafana is configured to provide real-time monitoring and visualization of IT Asset data from the Railway PostgreSQL database.

## Database User Setup

### 1. Create Read-Only Database User

Run as superuser in the **railway** database:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_reader') THEN
    CREATE ROLE grafana_reader WITH LOGIN PASSWORD 'GrafanaR3adOnly!2025';
  END IF;
END $$;

GRANT CONNECT ON DATABASE railway TO grafana_reader;
GRANT USAGE ON SCHEMA public TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_reader;
```

### 2. Bypass Row Level Security (RLS)

Since the application uses RLS with `app.current_user_id` context (which Grafana doesn't provide), grant BYPASSRLS to the read-only user:

```sql
ALTER ROLE grafana_reader BYPASSRLS;
```

This allows Grafana to read all data for monitoring purposes without needing user context.

## Grafana Data Source Configuration

### Connection Settings
- **Name:** IT Asset Tracker (or grafana-postgresql-datasource)
- **Host:** caboose.proxy.rlwy.net:31886
- **Database:** railway
- **User:** grafana_reader
- **Password:** GrafanaR3adOnly!2025
- **TLS/SSL Mode:** require
- **Version:** 12+

### Test Connection
Click "Save & Test" - you should see "Database Connection OK"

## Sample Queries

### Total Assets (Stat Panel)
```sql
SELECT COUNT(*) as value FROM assets;
```
**Visualization:** Stat or Gauge

### Assets List (Table Panel)
```sql
SELECT 
  id,
  name,
  category,
  status,
  location,
  serial_number
FROM assets
ORDER BY id DESC
LIMIT 20;
```
**Visualization:** Table

### Assets by Category (Pie Chart)
```sql
SELECT 
  category as metric,
  COUNT(*) as value
FROM assets
WHERE category IS NOT NULL
GROUP BY category
ORDER BY value DESC;
```
**Visualization:** Pie chart

### Assets by Status (Bar Chart)
```sql
SELECT 
  status as metric,
  COUNT(*) as value
FROM assets
WHERE status IS NOT NULL
GROUP BY status
ORDER BY value DESC;
```
**Visualization:** Bar chart

### Low Stock Consumables (Table)
```sql
SELECT 
  name,
  quantity,
  min_quantity,
  (min_quantity - quantity) as shortage
FROM consumables
WHERE quantity <= min_quantity
ORDER BY shortage DESC;
```
**Visualization:** Table

### Agent Activity Timeline (Time Series)
```sql
SELECT 
  date_trunc('hour', created_at)::timestamp as time,
  COUNT(*) as value
FROM agent_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY time
ORDER BY time;
```
**Visualization:** Time series

### Active Users (Stat)
```sql
SELECT COUNT(*) as value 
FROM auth_users 
WHERE is_active = true;
```
**Visualization:** Stat

### Total Licenses (Stat)
```sql
SELECT COUNT(*) as value FROM licenses;
```
**Visualization:** Stat

## Security Notes

- **grafana_reader** has SELECT-only permissions on all tables
- BYPASSRLS is granted to allow monitoring across all tenant data
- Password should be rotated periodically
- Grafana instance should be secured with authentication (admin user)
- Consider restricting Grafana access to internal networks only

## Troubleshooting

### "No data" in panels
1. Check Query Inspector → Data tab for errors
2. Verify RLS bypass: `SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'grafana_reader';`
3. Test permissions: 
   ```sql
   SET ROLE grafana_reader;
   SELECT COUNT(*) FROM assets;
   RESET ROLE;
   ```

### Connection errors
- Verify host/port are correct (caboose.proxy.rlwy.net:31886)
- Check database name is `railway` (not `postgres`)
- Ensure SSL mode is set correctly

### Permission denied errors
Run as superuser:
```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
ALTER ROLE grafana_reader BYPASSRLS;
```

## Dashboard Best Practices

1. **Group related metrics** (e.g., all asset stats in one row)
2. **Use consistent time ranges** across panels
3. **Set auto-refresh** for real-time monitoring (e.g., 30s or 1m)
4. **Add variables** for filtering (category, status, user)
5. **Export dashboards** as JSON for version control

## Maintenance

### Update Permissions for New Tables
When new tables are added, run:
```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
```

### Verify Connection
Periodically test the data source connection in Grafana settings.

### Monitor Query Performance
Use Query Inspector to check query execution times and optimize slow queries.
