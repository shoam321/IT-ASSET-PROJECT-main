# Grafana Dashboard Embedding Guide

## Overview
This guide explains how Grafana monitoring panels are embedded in the IT Asset Management React dashboard for unified analytics and monitoring.

## Architecture

### Iframe Embedding
Grafana panels are embedded using iframe solo mode, which displays individual panels without the full Grafana UI.

### URL Structure
```
{GRAFANA_URL}/d-solo/{dashboard-uid}/{dashboard-name}?orgId={orgId}&from={time-from}&to={time-to}&timezone=browser&panelId={panel-id}
```

**Parameters:**
- `d-solo`: Solo panel display mode (removes Grafana chrome)
- `dashboard-uid`: Unique dashboard identifier (e.g., `it-assets`)
- `dashboard-name`: URL-friendly dashboard name (e.g., `it-asset-dashboard`)
- `orgId`: Grafana organization ID (usually `1` for default org)
- `from`: Start time for data range (e.g., `now-7d`, `now-30d`, `1767010528669`)
- `to`: End time for data range (e.g., `now`, timestamp)
- `timezone`: Display timezone (`browser` uses client timezone)
- `panelId`: Panel identifier from Grafana dashboard (e.g., `1`, `2`, `3`)

## Implementation

### 1. Environment Configuration

Add Grafana URL to your `.env` file:

```bash
# Production Grafana URL
REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app

# For local Grafana development
# REACT_APP_GRAFANA_URL=http://localhost:3000
```

### 2. Dashboard Component Integration

The React Dashboard component includes:

**State Management:**
```javascript
const [showGrafana, setShowGrafana] = useState(true);
```

**URL Configuration:**
```javascript
const GRAFANA_URL = process.env.REACT_APP_GRAFANA_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://grafana-production-f114.up.railway.app');
```

**Panel Rendering:**
```jsx
<iframe
  src={`${GRAFANA_URL}/d-solo/it-assets/it-asset-dashboard?orgId=1&from=now-7d&to=now&timezone=browser&panelId=1`}
  width="100%"
  height="200"
  frameBorder="0"
  title="Total Assets"
  className="w-full"
/>
```

### 3. Embedded Panels

The dashboard includes 4 pre-configured panels:

1. **Total Assets** (`panelId=1`)
   - Display type: Stat or Gauge
   - Shows total asset count
   - 7-day time range

2. **Assets by Category** (`panelId=2`)
   - Display type: Pie chart or Bar chart
   - Shows asset distribution by category
   - 7-day time range

3. **Low Stock Items** (`panelId=3`)
   - Display type: Table
   - Shows consumables below minimum stock
   - Real-time data

4. **Recent Assets** (`panelId=4`)
   - Display type: Table
   - Shows recently added assets
   - 7-day time range

## Grafana Dashboard Setup

### Creating Dashboard in Grafana

1. **Login to Grafana:**
   - Navigate to `https://grafana-production-f114.up.railway.app`
   - Use admin credentials

2. **Create New Dashboard:**
   - Click "+" → "Dashboard"
   - Name: `IT Asset Dashboard`
   - UID: `it-assets` (set in dashboard settings)

3. **Add Panels:**
   For each panel:
   - Click "Add" → "Visualization"
   - Configure data source: PostgreSQL (`railway` database)
   - Write query (see sample queries below)
   - Set visualization type
   - Save panel with descriptive title
   - Note the `panelId` for embedding

### Sample Queries for Panels

**Total Assets (panelId=1):**
```sql
SELECT COUNT(*) as count
FROM assets
WHERE deleted_at IS NULL
```

**Assets by Category (panelId=2):**
```sql
SELECT 
  category,
  COUNT(*) as count
FROM assets
WHERE deleted_at IS NULL
GROUP BY category
ORDER BY count DESC
LIMIT 10
```

**Low Stock Items (panelId=3):**
```sql
SELECT 
  name,
  quantity,
  minimum_stock,
  (minimum_stock - quantity) as shortage
FROM consumables
WHERE quantity < minimum_stock
  AND deleted_at IS NULL
ORDER BY shortage DESC
LIMIT 10
```

**Recent Assets (panelId=4):**
```sql
SELECT 
  asset_tag,
  name,
  category,
  status,
  created_at
FROM assets
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 10
```

## Features

### Collapsible Section
- Toggle Grafana panels visibility with Show/Hide button
- Preserves screen space when not needed
- State persists during session

### Responsive Design
- 2-column grid on large screens
- Single column on mobile
- Panels scale to container width
- Fixed 200px height per panel

### External Link
- "Open Full Grafana Dashboard" link
- Opens complete Grafana UI in new tab
- Access to full dashboard features and editing

## Customization

### Adding More Panels

1. **Create Panel in Grafana:**
   - Add visualization to `IT Asset Dashboard`
   - Configure query and display
   - Note the `panelId` (visible in URL when editing)

2. **Add to React Dashboard:**
   ```jsx
   <div className="border border-gray-200 rounded-lg overflow-hidden">
     <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
       <h4 className="text-sm font-medium text-gray-700">Panel Title</h4>
     </div>
     <iframe
       src={`${GRAFANA_URL}/d-solo/it-assets/it-asset-dashboard?orgId=1&from=now-7d&to=now&timezone=browser&panelId=NEW_PANEL_ID`}
       width="100%"
       height="200"
       frameBorder="0"
       title="Panel Title"
       className="w-full"
     />
   </div>
   ```

### Adjusting Time Ranges

Change `from` and `to` parameters:
- Last 24 hours: `from=now-24h&to=now`
- Last 30 days: `from=now-30d&to=now`
- This month: `from=now/M&to=now`
- Fixed range: `from=1767010528669&to=1767032128669` (Unix timestamps in ms)

### Panel Heights

Adjust iframe `height` attribute:
- Small stat panels: `150-200px`
- Tables with scrolling: `300-400px`
- Complex charts: `250-350px`

## Security Considerations

### Authentication
- Grafana panels are publicly viewable if dashboard/panel is public
- For private panels, users must be logged into Grafana
- Consider enabling "Public Dashboard" for embedded panels
- Or use API keys/service tokens for authentication

### CORS Configuration
Grafana must allow iframe embedding:
```ini
[security]
allow_embedding = true
```

### CSP Headers
Ensure React app's Content Security Policy allows Grafana:
```
frame-src 'self' https://grafana-production-f114.up.railway.app;
```

## Performance

### Caching
- Panels cache results based on time range
- Automatic refresh every 30 seconds (configurable)
- Browser caches iframe content

### Load Optimization
- Use collapsible section to defer iframe loading
- Lazy load panels below fold
- Consider loading panels on user interaction

## Troubleshooting

### Panel Not Loading
1. Check GRAFANA_URL environment variable
2. Verify dashboard UID and panelId are correct
3. Check browser console for CORS errors
4. Confirm Grafana allows embedding

### "No Data" in Panel
1. Verify Grafana data source connection
2. Check query in Grafana Query Inspector
3. Ensure `grafana_reader` has permissions
4. Verify time range includes data

### Authentication Required
1. Enable public dashboard in Grafana settings
2. Or implement authentication flow
3. Consider using anonymous access for specific dashboards

### Wrong Data Displayed
1. Confirm correct database selected in data source
2. Check RLS policies if using Row Level Security
3. Verify `grafana_reader` has BYPASSRLS if needed

## Maintenance

### Regular Tasks
- Review panel queries for performance
- Update time ranges as needed
- Add new panels for emerging metrics
- Remove obsolete panels

### Monitoring
- Check iframe load times
- Monitor Grafana query performance
- Review user engagement with panels
- Track dashboard errors in logs

## Future Enhancements

### Potential Improvements
- Dynamic panel configuration from backend
- User-selectable time ranges
- Panel refresh controls
- Full-screen panel view
- Download panel data as CSV
- Custom themes matching app design
- Real-time updates via WebSockets
- Panel annotations and alerts

### Integration Ideas
- Link panels to detailed views in app
- Cross-filter between app and Grafana
- Unified authentication with SSO
- Embedded Grafana Explore for ad-hoc queries
- Alert notifications in app UI

## References

- [Grafana Panels Documentation](https://grafana.com/docs/grafana/latest/panels/)
- [Solo Panel Mode](https://grafana.com/docs/grafana/latest/dashboards/share-dashboards-panels/#solo-panel-mode)
- [Grafana Embedding](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/#embed-dashboards)
- [GRAFANA_SETUP.md](./GRAFANA_SETUP.md) - Database configuration and queries
