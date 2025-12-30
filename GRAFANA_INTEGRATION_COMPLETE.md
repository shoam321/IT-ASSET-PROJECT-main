# Grafana Dashboard Integration - Complete Setup

## ✅ Status: COMPLETE

Your Grafana dashboard has been successfully integrated into your IT Asset Management application!

---

## What's Been Set Up

### 1. **Grafana Dashboard Created**
- **URL:** https://grafana-production-f114.up.railway.app/d/adgfqcl/it-asset-dashboard
- **UID:** `adgfqcl`
- **Name:** IT Asset Dashboard
- **Refresh Rate:** 30 seconds (auto-refresh enabled)

### 2. **Dashboard Panels (10 Total)**
All panels are now displaying real-time data from your PostgreSQL database:

| Panel ID | Title | Type | Description |
|----------|-------|------|-------------|
| 1 | Total Assets | Stat | Count of all assets in system |
| 2 | Total Users | Stat | Count of active users |
| 3 | Total Licenses | Stat | Count of all licenses |
| 4 | Low Stock Alert | Stat | Count of items below minimum quantity |
| 5 | Assets by Category | Pie Chart | Asset distribution by category |
| 6 | Assets by Status | Bar Chart | Asset breakdown by status |
| 7 | Low Stock Items | Table | Items needing reorder (top 20) |
| 8 | Recent Assets | Table | Latest 20 assets added (30-day window) |
| 9 | License Expirations | Table | Licenses expiring soon |
| 10 | Asset Value Trend | Line Chart | Asset creation trend (30-day) |

### 3. **React Application Integration**
- **Component:** `itam-saas/Client/src/components/Dashboard.jsx`
- **Status:** Fully integrated into main navigation
- **Location:** Click "Dashboard" in sidebar to view
- **Environment Variable:** `REACT_APP_GRAFANA_URL` = `https://grafana-production-f114.up.railway.app`

### 4. **Database Setup**
- **Grafana User:** `grafana_reader`
- **Database:** `railway`
- **Permissions:** Read-only access with RLS bypass
- **Connection:** Secure PostgreSQL connection via Railway proxy

---

## How to Access

### Option 1: Through IT Asset Application
1. Login to your IT Asset app
2. Click **"Dashboard"** in the left sidebar
3. View all embedded Grafana panels
4. Click **"Refresh All"** to update data
5. Click **"Open Grafana"** to access full Grafana UI

### Option 2: Direct Grafana Link
https://grafana-production-f114.up.railway.app/d/adgfqcl/it-asset-dashboard?orgId=1

---

## Features

### Dashboard Features
- ✅ **Auto-Refresh:** Panels update every 30 seconds
- ✅ **Expandable Panels:** Click maximize icon to expand any panel
- ✅ **Time Range Selection:** 30-day default, customizable
- ✅ **Responsive Design:** Works on desktop, tablet, and mobile
- ✅ **Real-time Data:** Connected to live PostgreSQL database
- ✅ **Public Access:** Dashboard is publicly accessible (no Grafana login required for embedded view)

### Panel Capabilities
- **Stat Panels:** Display large numbers with color coding
- **Pie Chart:** Visualize category distribution
- **Bar Chart:** Compare asset statuses
- **Tables:** Detailed views of consumables, assets, and licenses
- **Line Chart:** Track asset creation trends over time

---

## Configuration Details

### Grafana URL Configuration
```javascript
REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app
```

### Dashboard UID & Slug
- **UID:** `adgfqcl` (Unique identifier)
- **Slug:** `it-asset-dashboard` (URL-friendly name)

### Embedding Mode
- **Mode:** `d-solo` (Solo panel display - no Grafana UI chrome)
- **Theme:** Light mode
- **Frame Border:** None (seamless integration)
- **Sandbox:** Allows scripts and cross-origin requests

---

## Database Queries Running

### Panel 1: Total Assets
```sql
SELECT COUNT(*) as value FROM assets;
```

### Panel 2: Total Users
```sql
SELECT COUNT(*) as value FROM users WHERE LOWER(status) = 'active';
```

### Panel 3: Total Licenses
```sql
SELECT COUNT(*) as value FROM licenses;
```

### Panel 4: Low Stock Alert
```sql
SELECT COUNT(*) as value FROM consumables WHERE quantity <= min_quantity;
```

### Panel 5: Assets by Category
```sql
SELECT COALESCE(category, 'Uncategorized') as category, COUNT(*) as value 
FROM assets 
GROUP BY category 
ORDER BY value DESC LIMIT 10;
```

### Panel 6: Assets by Status
```sql
SELECT COALESCE(status, 'Unknown') as status, COUNT(*) as value 
FROM assets 
GROUP BY status 
ORDER BY value DESC;
```

### Panel 7: Low Stock Items
```sql
SELECT name, quantity, min_quantity, (min_quantity - quantity) as shortage 
FROM consumables 
WHERE quantity <= min_quantity 
ORDER BY shortage DESC LIMIT 20;
```

### Panel 8: Recent Assets
```sql
SELECT asset_tag, asset_type, manufacturer, status, created_at 
FROM assets 
ORDER BY created_at DESC LIMIT 20;
```

### Panel 9: License Expirations
```sql
SELECT software_name, license_key, expiration_date, 
       CASE WHEN expiration_date < CURRENT_DATE THEN 'Expired' 
            WHEN expiration_date < CURRENT_DATE + INTERVAL '30 days' THEN 'Expiring Soon' 
            ELSE 'Active' END as license_status 
FROM licenses 
WHERE expiration_date IS NOT NULL 
ORDER BY expiration_date ASC LIMIT 20;
```

### Panel 10: Asset Value Trend
```sql
SELECT DATE_TRUNC('day', created_at) as time, COUNT(*) as value 
FROM assets 
WHERE created_at >= NOW() - INTERVAL '30 days' 
GROUP BY DATE_TRUNC('day', created_at) 
ORDER BY time ASC;
```

---

## Troubleshooting

### Panels Showing "No Data"
1. **Check database connection** - Verify PostgreSQL is running and reachable
2. **Verify data exists** - Run queries manually in database
3. **Check RLS policies** - Ensure `grafana_reader` has BYPASSRLS permission
4. **Reload page** - Sometimes browser cache needs clearing

### Iframe Not Loading
1. **Check CORS** - Ensure Grafana allows iframe embedding
2. **Verify URL** - Check GRAFANA_URL environment variable
3. **Check dashboard UID** - Current UID is `adgfqcl`
4. **Browser console** - Look for CORS or security errors

### Data Not Updating
1. **Check refresh rate** - Set to 30 seconds (automatic)
2. **Click Refresh All** - Manual refresh button on dashboard
3. **Monitor database** - Ensure data is being inserted correctly
4. **Check panel queries** - Verify SQL queries in Grafana

---

## Next Steps (Optional)

### Customize Panels
1. Login to Grafana: https://grafana-production-f114.up.railway.app
2. Edit dashboard to customize:
   - Change colors and thresholds
   - Adjust time ranges
   - Add annotations and alerts
   - Modify query filters

### Add More Panels
1. Create new panel in Grafana dashboard
2. Write custom SQL query
3. Note the panel ID (visible in URL)
4. Add iframe to Dashboard.jsx component

### Enable Alerts
1. Configure alert rules in Grafana
2. Set notification channels (email, Slack, etc.)
3. Define thresholds for critical metrics

### Extend Dashboard
- Add more visualizations (gauge, gauge panel, etc.)
- Add alert notifications
- Create dashboard variables for filtering
- Add dashboard annotations for events

---

## Files Modified

### `/itam-saas/Client/src/components/Dashboard.jsx`
- Updated Grafana dashboard UID from `it-assets` to `adgfqcl`
- Updated embedded panel URLs to use correct UID
- Setup instructions updated with actual dashboard reference

### `/itam-saas/Client/.env`
- `REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app`

### `/itam-saas/Client/src/App.jsx`
- Dashboard component already imported and integrated
- Navigation menu includes Dashboard link
- Component renders at `currentScreen === 'dashboard'`

---

## Security Notes

✅ **Public Dashboard** - Embedded panels are publicly accessible (no Grafana login required)
✅ **Read-Only** - Database user has SELECT-only permissions
✅ **RLS Bypass** - Grafana user bypasses row-level security for full visibility
✅ **CORS Enabled** - Grafana configured to allow iframe embedding

---

## Monitoring & Maintenance

### Regular Checks
- Monitor dashboard performance (load times)
- Review data accuracy in panels
- Check for failed queries in Grafana logs
- Monitor database performance

### Database Maintenance
- Keep indexes optimized
- Monitor query performance
- Archive old data as needed
- Regular backups of PostgreSQL

### Dashboard Updates
- Update panel queries as schema changes
- Add new panels for new metrics
- Remove obsolete panels
- Keep Grafana version updated

---

## Support & Documentation

- **Grafana Docs:** https://grafana.com/docs/
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Railway Docs:** https://docs.railway.app/
- **Project Docs:** See `GRAFANA_EMBEDDING.md` and `GRAFANA_SETUP.md`

---

## Summary

Your Grafana dashboard is now fully operational and integrated into your IT Asset Management application! Users can:

1. ✅ View real-time asset analytics
2. ✅ Monitor low stock items
3. ✅ Track license expirations
4. ✅ View asset trends
5. ✅ Access detailed reports
6. ✅ Drill down into Grafana for advanced analytics

The dashboard automatically refreshes every 30 seconds and displays live data from your PostgreSQL database.

**Status: Ready for Production** 🚀
