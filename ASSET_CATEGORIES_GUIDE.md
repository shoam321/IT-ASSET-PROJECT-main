# Asset Categories Feature - Setup Guide

## Overview
This feature adds categorization to IT assets with visual icons for easy identification. Categories include computers, laptops, switches, routers, cables, printers, and more.

## Features Added

### 1. **22 Asset Categories with Icons**
- Computers & Laptops
- Servers & Network Equipment (Switches, Routers, Access Points)
- Peripherals (Monitors, Keyboards, Mouse, Printers)
- Cables & Connectivity
- Mobile Devices (Phones, Tablets)
- Storage Devices
- And more...

### 2. **Visual Category Icons**
- Each category has a unique icon from Lucide React
- Color-coded badges for quick recognition
- Icons displayed in asset lists and forms

### 3. **Database Changes**
- Added `category` column to assets table
- Indexed for fast filtering
- Backwards compatible with existing assets

## Installation Steps

### Step 1: Database Migration

You need to add the `category` column to your `assets` table. Choose one of the methods below:

#### Method A: Using DBeaver (Recommended for Railway)

1. Open DBeaver and connect to your Railway PostgreSQL database
2. Navigate to your database → public → Tables → assets
3. Right-click on `assets` → **Alter Table**
4. Click **Add Column** and create:
   - **Column Name**: `category`
   - **Data Type**: `VARCHAR(100)`
   - **Nullable**: Yes (checked)
5. Click **Save** or **Execute**
6. Run this SQL to create an index:
   ```sql
   CREATE INDEX idx_assets_category ON assets(category);
   ```
7. (Optional) Update existing assets with default categories:
   ```sql
   UPDATE assets 
   SET category = CASE 
     WHEN asset_type = 'hardware' THEN 'computer'
     WHEN asset_type = 'network' THEN 'network-switch'
     WHEN asset_type = 'software' THEN 'software'
     WHEN asset_type = 'cloud' THEN 'cloud'
     ELSE 'other'
   END
   WHERE category IS NULL;
   ```

#### Method B: Using psql CLI

If you have direct database access:

```bash
psql "your-database-url"
```

Then run:

```sql
ALTER TABLE assets ADD COLUMN category VARCHAR(100);
CREATE INDEX idx_assets_category ON assets(category);

-- Optional: Set default categories for existing assets
UPDATE assets 
SET category = CASE 
  WHEN asset_type = 'hardware' THEN 'computer'
  WHEN asset_type = 'network' THEN 'network-switch'
  WHEN asset_type = 'software' THEN 'software'
  WHEN asset_type = 'cloud' THEN 'cloud'
  ELSE 'other'
END
WHERE category IS NULL;
```

#### Method C: Migration Script (Requires Database Owner Access)

If you have owner/superuser database credentials:

1. Add to your `.env` file:
   ```
   DATABASE_URL_OWNER=postgresql://owner_user:password@host:port/database
   ```

2. Run:
   ```bash
   cd itam-saas/Agent
   node add-category-column.js
   ```

### Step 2: Restart Backend

After adding the database column, restart your backend server:

```powershell
# If running locally
# Press Ctrl+C in the terminal running the backend
# Then restart:
cd itam-saas/Agent
npm start
```

Or if using Railway, the backend will auto-restart after detecting changes.

### Step 3: Refresh Frontend

Clear your browser cache and refresh:
- Press **Ctrl + F5** (hard refresh)
- Or clear site data: F12 → Application → Clear Site Data

## Using the Feature

### Adding a New Asset with Category

1. Click **Add Asset** button
2. Fill in the asset details
3. Select a **Category** from the dropdown (shows all 22 options)
4. Save the asset

### Viewing Assets with Categories

- The asset list now shows a **Category** column
- Each category has a colored icon badge for quick visual identification
- Icons include: 💻 Computer, 🖥️ Laptop, 🖧 Server, 🔌 Cable, etc.

### Available Categories

| Category | Icon | Use Case |
|----------|------|----------|
| Computer | Monitor | Desktop workstations |
| Laptop | Laptop | Portable computers |
| Server | Server | Physical/virtual servers |
| Network Switch | Network | Switches, hubs |
| Router | Router | Routers, gateways |
| Cable | Cable | Network/power/HDMI cables |
| Printer | Printer | Printers, scanners |
| Phone | Smartphone | Mobile devices |
| Tablet | Tablet | Tablets, iPads |
| Monitor | MonitorSpeaker | Display screens |
| Keyboard | Keyboard | Input devices |
| Mouse | Mouse | Pointing devices |
| Storage Device | HardDrive | HDDs, SSDs, USB drives |
| UPS/Power | Zap | Power supplies |
| Camera | Camera | Security cams, webcams |
| Headset | Headphones | Audio equipment |
| Docking Station | Dock | Laptop docks, hubs |
| Server Rack | Container | Server racks |
| Access Point | Wifi | WiFi equipment |
| Software License | Package | Software licenses |
| Cloud Service | Cloud | SaaS subscriptions |
| Other | Box | Miscellaneous equipment |

## Files Modified

### Backend
- `itam-saas/Agent/queries.js` - Updated createAsset to handle category field
- `itam-saas/Agent/add-category-column.js` - Migration script

### Frontend
- `itam-saas/Client/src/App.jsx` - Added category dropdown and display
- `itam-saas/Client/src/config/assetCategories.js` - Category definitions
- `itam-saas/Client/src/components/CategoryIcon.jsx` - Icon renderer component

### Database
- `assets` table - New `category` column (VARCHAR(100))
- Index on `category` for performance

## Troubleshooting

### "Category column not found" error

**Solution**: Run the database migration (Step 1 above)

### Categories not showing in dropdown

**Solution**: 
1. Check browser console for errors
2. Clear browser cache (Ctrl + F5)
3. Verify `assetCategories.js` file exists

### Icons not displaying

**Solution**:
1. Make sure all Lucide React icons are imported in App.jsx
2. Check `CategoryIcon.jsx` component exists
3. Restart frontend development server

### Database permission errors

**Solution**: Use DBeaver (Method A) to manually add the column. You don't need special permissions to alter a table in the Railway web interface.

## Future Enhancements

Potential additions:
- Category-based filtering in asset list
- Category statistics on dashboard
- Custom categories per organization
- Category-based asset templates
- Bulk category assignment

## Support

If you encounter issues:
1. Check that database migration completed successfully
2. Verify backend and frontend are running latest code
3. Check browser console and backend logs for errors
4. Make sure you refreshed the browser after changes
