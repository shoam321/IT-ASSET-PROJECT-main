# Grafana Dashboard Setup - Step by Step

## Issue Resolution
The dashboard JSON is now valid, but it needs proper configuration in Grafana to display data.

## Prerequisites

### 1. Create Grafana Read-Only Database User

The dashboard queries need a database user that can bypass RLS (Row Level Security). Run these SQL commands in your Railway PostgreSQL database:

```sql
-- Create read-only user for Grafana
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'grafana_reader') THEN
    CREATE ROLE grafana_reader WITH LOGIN PASSWORD 'GrafanaR3adOnly!2025';
  END IF;
END $$;

-- Grant permissions
GRANT CONNECT ON DATABASE railway TO grafana_reader;
GRANT USAGE ON SCHEMA public TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO grafana_reader;

-- IMPORTANT: Bypass RLS so Grafana can see all data
ALTER ROLE grafana_reader BYPASSRLS;
```

### 2. Verify Your Database Has Data

Check if you have data in your tables:

```sql
SELECT COUNT(*) as assets FROM assets;
SELECT COUNT(*) as licenses FROM licenses;
SELECT COUNT(*) as consumables FROM consumables;
SELECT COUNT(*) as users FROM users WHERE is_active = true;
```

If you have no data, run the seed script:

```bash
node seed-demo-data.js
```

## Grafana Setup Steps

### Step 1: Add PostgreSQL Data Source

1. Open Grafana (your Railway Grafana instance)
2. Go to **Configuration** → **Data Sources**
3. Click **Add data source**
4. Select **PostgreSQL**
5. Configure with these settings:
   - **Name:** `PostgreSQL` (exactly this name)
   - **Host:** `caboose.proxy.rlwy.net:31886`
   - **Database:** `railway`
   - **User:** `grafana_reader`
   - **Password:** `GrafanaR3adOnly!2025`
   - **TLS/SSL Mode:** `require`
   - **Version:** `12+`
6. Click **Save & Test** - should show "Database Connection OK"

### Step 2: Import the Dashboard

1. Go to **Dashboards** → **Import**
2. Click **Upload JSON file**
3. Select `grafana-dashboard-import.json`
4. When prompted for data source, select **PostgreSQL** (the one you just created)
5. Click **Import**

### Step 3: Verify Data Appears

The dashboard should now show:
- **Total Assets** - Count of all assets
- **Total Users** - Count of active users
- **Total Licenses** - Count of all licenses
- **Low Stock Alert** - Count of consumables below minimum quantity
- **Assets by Category** - Pie chart breakdown
- **Assets by Status** - Bar chart
- **Low Stock Items** - Table of items needing reorder
- **Recent Assets** - Last 20 assets added
- **License Expirations** - Upcoming license renewals
- **Asset Value Trend** - Asset creation over last 30 days

## Troubleshooting

### "No data" in panels

**Check database connection:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE table_name = 'assets') as has_assets,
  COUNT(*) FILTER (WHERE table_name = 'licenses') as has_licenses,
  COUNT(*) FILTER (WHERE table_name = 'consumables') as has_consumables,
  COUNT(*) FILTER (WHERE table_name = 'users') as has_users
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('assets', 'licenses', 'consumables', 'users');
```

**Test a simple query in Grafana's Explore:**
1. Go to **Explore** in Grafana
2. Select the PostgreSQL data source
3. Run: `SELECT COUNT(*) as value FROM assets;`
4. Should return a number

### Permission errors

If you see permission denied errors, the `grafana_reader` user needs BYPASSRLS:

```sql
ALTER ROLE grafana_reader BYPASSRLS;
```

### Wrong table names

Some queries might need adjustment based on your actual schema. Check your table names:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Common table name issues:
- `auth_users` vs `users` (fixed in the JSON)
- Make sure `consumables` table exists (run migrations if needed)

### Data source variable not working

If `${POSTGRES_UID}` doesn't resolve:
1. Go to **Dashboard Settings** → **Variables**
2. Make sure `POSTGRES_UID` variable exists and points to your PostgreSQL data source
3. The JSON now includes this variable definition

## Next Steps

1. **Customize the dashboard** - Add more panels for specific metrics
2. **Set up alerts** - Configure alerts for low stock, license expiration
3. **Share the dashboard** - Create a public link or embed it in your app
4. **Auto-refresh** - Dashboard refreshes every 30 seconds by default

## Quick Test

Run this in Grafana's Explore to verify everything works:

```sql
SELECT 
  (SELECT COUNT(*) FROM assets) as total_assets,
  (SELECT COUNT(*) FROM licenses) as total_licenses,
  (SELECT COUNT(*) FROM consumables WHERE quantity <= min_quantity) as low_stock_items,
  (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users;
```

This should return one row with all the counts.
