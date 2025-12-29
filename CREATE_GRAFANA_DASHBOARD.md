# Create Grafana Dashboard - Step by Step

## Problem
Dashboard "it-assets" not found in Grafana. You need to create it first.

## Quick Setup (Manual - 10 minutes)

### Step 1: Login to Grafana
1. Open https://grafana-production-f114.up.railway.app
2. Login with your admin credentials (from Railway environment variables)

### Step 2: Create New Dashboard
1. Click **"+"** (plus icon) in left sidebar
2. Select **"Dashboard"**
3. Click **"Add visualization"**

### Step 3: Configure Data Source (First Panel Only)
1. Select **"PostgreSQL"** data source
2. If no data source exists:
   - Click **"Data Sources"** in left sidebar (gear icon → Data Sources)
   - Click **"Add data source"**
   - Select **"PostgreSQL"**
   - Configure:
     ```
     Name: Railway PostgreSQL
     Host: caboose.proxy.rlwy.net:31886
     Database: railway
     User: grafana_reader
     Password: GrafanaR3adOnly!2025
     TLS/SSL Mode: require
     Version: 12+
     ```
   - Click **"Save & test"**
   - Go back to dashboard creation

### Step 4: Create Panels (10 panels needed)

Your frontend expects these exact panel IDs:

#### Panel 1: Total Assets
1. Add new panel
2. **Query**:
   ```sql
   SELECT COUNT(*) as "Total Assets"
   FROM assets
   WHERE deleted_at IS NULL
   ```
3. **Visualization**: Stat
4. **Panel options**:
   - Title: `Total Assets`
5. **Apply** and **Save**

#### Panel 2: Total Users
1. Add new panel
2. **Query**:
   ```sql
   SELECT COUNT(*) as "Total Users"
   FROM auth_users
   WHERE is_active = true
   ```
3. **Visualization**: Stat
4. **Panel options**:
   - Title: `Total Users`
5. **Apply** and **Save**

#### Panel 3: Total Licenses
1. Add new panel
2. **Query**:
   ```sql
   SELECT COUNT(*) as "Total Licenses"
   FROM licenses
   WHERE deleted_at IS NULL
   ```
3. **Visualization**: Stat
4. **Panel options**:
   - Title: `Total Licenses`
5. **Apply** and **Save**

#### Panel 4: Low Stock Alert
1. Add new panel
2. **Query**:
   ```sql
   SELECT COUNT(*) as "Low Stock Items"
   FROM consumables
   WHERE quantity <= min_quantity
     AND deleted_at IS NULL
   ```
3. **Visualization**: Stat
4. **Panel options**:
   - Title: `Low Stock Alert`
   - Color: Red/Orange for threshold
5. **Apply** and **Save**

#### Panel 5: Assets by Category
1. Add new panel
2. **Query**:
   ```sql
   SELECT 
     COALESCE(category, 'Uncategorized') as category,
     COUNT(*) as count
   FROM assets
   WHERE deleted_at IS NULL
   GROUP BY category
   ORDER BY count DESC
   LIMIT 10
   ```
3. **Visualization**: Pie chart
4. **Panel options**:
   - Title: `Assets by Category`
5. **Apply** and **Save**

#### Panel 6: Assets by Status
1. Add new panel
2. **Query**:
   ```sql
   SELECT 
     COALESCE(status, 'Unknown') as status,
     COUNT(*) as count
   FROM assets
   WHERE deleted_at IS NULL
   GROUP BY status
   ORDER BY count DESC
   ```
3. **Visualization**: Bar chart
4. **Panel options**:
   - Title: `Assets by Status`
5. **Apply** and **Save**

#### Panel 7: Low Stock Items
1. Add new panel
2. **Query**:
   ```sql
   SELECT 
     name,
     quantity,
     min_quantity as "Minimum Stock",
     (min_quantity - quantity) as "Shortage"
   FROM consumables
   WHERE quantity <= min_quantity
     AND deleted_at IS NULL
   ORDER BY (min_quantity - quantity) DESC
   LIMIT 20
   ```
3. **Visualization**: Table
4. **Panel options**:
   - Title: `Low Stock Items`
5. **Apply** and **Save**

#### Panel 8: Recent Assets (Last 30 Days)
1. Add new panel
2. **Query**:
   ```sql
   SELECT 
     name,
     category,
     status,
     location,
     created_at as "Added Date"
   FROM assets
   WHERE deleted_at IS NULL
     AND created_at >= NOW() - INTERVAL '30 days'
   ORDER BY created_at DESC
   LIMIT 20
   ```
3. **Visualization**: Table
4. **Panel options**:
   - Title: `Recent Assets (Last 30 Days)`
5. **Apply** and **Save**

#### Panel 9: License Expirations
1. Add new panel
2. **Query**:
   ```sql
   SELECT 
     software_name as "Software",
     license_key as "License Key",
     expiry_date as "Expiration Date",
     CASE 
       WHEN expiry_date < CURRENT_DATE THEN 'Expired'
       WHEN expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'Expiring Soon'
       ELSE 'Active'
     END as "Status"
   FROM licenses
   WHERE deleted_at IS NULL
     AND expiry_date IS NOT NULL
   ORDER BY expiry_date ASC
   LIMIT 20
   ```
3. **Visualization**: Table
4. **Panel options**:
   - Title: `License Expirations`
5. **Apply** and **Save**

#### Panel 10: Asset Value Trend
1. Add new panel
2. **Query**:
   ```sql
   SELECT 
     DATE_TRUNC('day', created_at) as time,
     COUNT(*) as "Assets Added"
   FROM assets
   WHERE deleted_at IS NULL
     AND created_at >= NOW() - INTERVAL '30 days'
   GROUP BY DATE_TRUNC('day', created_at)
   ORDER BY time ASC
   ```
3. **Visualization**: Time series / Line chart
4. **Panel options**:
   - Title: `Asset Value Trend`
5. **Apply** and **Save**

### Step 5: Set Dashboard UID and Save
1. Click **⚙️ (Settings gear icon)** in top right
2. In **General** section:
   - **Name**: `IT Asset Dashboard`
   - **UID**: `it-assets` (IMPORTANT - must be exactly this)
3. Click **"Save dashboard"**
4. Add description: "Main monitoring dashboard for IT Asset Tracker"
5. Click **"Save"**

### Step 6: Verify Panel IDs
1. Edit each panel and check the URL
2. Panel ID should be in format: `&editPanel=1`, `&editPanel=2`, etc.
3. If panel IDs don't match (1-10), you need to reorder or recreate them

### Step 7: Test the Dashboard
1. Go back to your frontend: https://it-asset-project.vercel.app
2. Navigate to the monitoring/dashboard page
3. All panels should now load with data

## Alternative: Import Dashboard JSON (Faster)

I can create a dashboard JSON file that you can import directly into Grafana. This will create all 10 panels automatically.

Would you like me to generate the JSON import file?

## Troubleshooting

### "No data" in panels
- Check data source connection in Grafana settings
- Verify `grafana_reader` user has BYPASSRLS permission
- Test queries directly in Grafana query editor

### Panel IDs don't match
- Delete dashboard and recreate panels in order (1-10)
- Or edit Dashboard.jsx to match your panel IDs

### Still seeing "dashboard not found"
- Verify UID is exactly `it-assets` (no spaces, lowercase)
- Check dashboard is saved in "Main Org." organization
- Clear browser cache after saving dashboard

## Quick Verification Command

Run this to check if the dashboard URL is accessible:

```powershell
$url = "https://grafana-production-f114.up.railway.app/d/it-assets/it-asset-dashboard"
Invoke-WebRequest -Uri $url -UseBasicParsing | Select-Object StatusCode
```

If you get 200, the dashboard exists!
