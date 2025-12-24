# IT Asset Agent - Testing Guide

## Pre-Testing Checklist

- [ ] Database migration applied (`add-usage-tracking.sql`)
- [ ] Backend server running on port 5000
- [ ] Valid JWT token available for testing
- [ ] Tauri agent built successfully

## Testing Steps

### 1. Database Schema Testing

#### Apply Migration
```powershell
# Connect to your PostgreSQL database
psql -U your_user -d your_database -f itam-saas/Agent/migrations/add-usage-tracking.sql
```

#### Verify Tables
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('devices', 'device_usage', 'installed_apps', 'device_heartbeats');

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('devices', 'device_usage', 'installed_apps');
```

**Expected Result**: All 4 tables and indexes should exist

---

### 2. Backend API Testing

#### Start Backend Server
```powershell
cd itam-saas/Agent
npm start
```

#### Test Agent Endpoints

**A. Heartbeat Endpoint**
```powershell
$token = "YOUR_JWT_TOKEN_HERE"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    device_id = "test-device-001"
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    hostname = "TEST-PC"
    os_name = "Windows 11"
    os_version = "22H2"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/agent/heartbeat" -Method POST -Headers $headers -Body $body
```

**Expected Response**: `{ "message": "Heartbeat received", ... }`

**B. Usage Data Endpoint**
```powershell
$usageBody = @{
    device_id = "test-device-001"
    app_name = "Google Chrome"
    window_title = "Testing - IT Asset Manager"
    duration = 120
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/agent/usage" -Method POST -Headers $headers -Body $usageBody
```

**Expected Response**: `{ "message": "Usage data recorded", ... }`

**C. Get Devices**
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/agent/devices" -Headers $headers
```

**Expected Response**: Array of devices including `test-device-001`

---

### 3. Tauri Agent Testing

#### Build and Run Agent
```powershell
cd itam-saas/TauriAgent
npm run tauri dev
```

#### Test Cases

**A. System Tray**
- [ ] Agent icon appears in system tray
- [ ] Right-click shows menu (Show, Hide, Quit)
- [ ] Clicking tray icon shows/hides window
- [ ] Closing window minimizes to tray (doesn't quit)

**B. Process Monitoring**
- [ ] "Current Activity" shows active application
- [ ] Activity updates every 5 seconds
- [ ] Recent activity list populates
- [ ] Process names are accurate

**C. UI Status**
- [ ] Connection status shows "Connected"
- [ ] System info displays correctly
- [ ] Status text shows "Monitoring Active"

**D. Configuration**
- [ ] Agent reads config.json settings
- [ ] API URL configurable
- [ ] Polling interval adjustable

---

### 4. Integration Testing

#### Full Workflow Test

1. **Start Backend**
```powershell
cd itam-saas/Agent
npm start
```

2. **Start Agent**
```powershell
cd itam-saas/TauriAgent
npm run tauri dev
```

3. **Login to Web Dashboard**
- Navigate to `http://localhost:3000`
- Login with credentials
- Go to Usage Monitor page

4. **Verify Data Flow**
- [ ] Device appears in devices list
- [ ] Last seen timestamp updates
- [ ] App usage data appears
- [ ] Usage statistics calculate correctly

---

### 5. Database Queries Testing

#### Check Device Data
```sql
SELECT * FROM devices ORDER BY last_seen DESC LIMIT 10;
```

#### Check Usage Data
```sql
SELECT 
  device_id,
  app_name,
  COUNT(*) as usage_count,
  SUM(duration) as total_duration
FROM device_usage
GROUP BY device_id, app_name
ORDER BY total_duration DESC
LIMIT 20;
```

#### Check Heartbeats
```sql
SELECT 
  device_id,
  COUNT(*) as heartbeat_count,
  MAX(timestamp) as last_heartbeat
FROM device_heartbeats
GROUP BY device_id;
```

---

### 6. Frontend Dashboard Testing

#### Usage Monitor Component

**Navigation**
- [ ] UsageMonitor component accessible from menu
- [ ] Page loads without errors
- [ ] CSS styles applied correctly

**Device List**
- [ ] All devices display
- [ ] Status indicators work (Online/Idle/Offline)
- [ ] Device selection works
- [ ] Device stats show correct counts

**Usage Stats Table**
- [ ] Shows usage data for selected device
- [ ] Data sorted by total duration
- [ ] Timestamps formatted correctly
- [ ] Refresh button works

**App Summary**
- [ ] Top 10 apps displayed
- [ ] Progress bars scale correctly
- [ ] Device counts accurate
- [ ] Duration formatting correct

**Auto-Refresh**
- [ ] Data refreshes every 30 seconds
- [ ] No memory leaks
- [ ] Performance remains stable

---

### 7. Performance Testing

#### Agent Performance
```powershell
# Check agent memory usage
Get-Process | Where-Object {$_.ProcessName -like "*tauri*"} | Select-Object ProcessName, @{Name="Memory(MB)";Expression={[math]::Round($_.WorkingSet / 1MB, 2)}}
```

**Expected**: <15 MB memory usage

#### API Response Times
- Heartbeat: <100ms
- Usage data insert: <200ms
- Device list: <500ms
- Usage stats: <1s

---

### 8. Error Handling Testing

#### Network Failures
- [ ] Agent handles API unreachable
- [ ] Retry logic works
- [ ] Error states display correctly

#### Invalid Data
- [ ] Backend validates required fields
- [ ] Proper error messages returned
- [ ] Frontend handles errors gracefully

#### Authentication
- [ ] Expired tokens rejected
- [ ] Unauthorized requests blocked
- [ ] Token refresh works

---

## Test Results Template

```markdown
## Test Execution: [DATE]

### Database Schema ✅/❌
- Tables created: ✅
- Indexes created: ✅
- Triggers working: ✅

### Backend API ✅/❌
- Heartbeat: ✅
- Usage data: ✅
- Device list: ✅

### Tauri Agent ✅/❌
- System tray: ✅
- Process monitoring: ✅
- UI display: ✅

### Integration ✅/❌
- End-to-end flow: ✅
- Data persistence: ✅
- Real-time updates: ✅

### Performance ✅/❌
- Memory usage: 12 MB ✅
- API response: <200ms ✅
- No memory leaks: ✅

### Issues Found
- None

### Notes
- All tests passing
- Ready for deployment
```

---

## Troubleshooting

### Agent Won't Connect
1. Check `config.json` API URL
2. Verify backend is running
3. Check JWT token validity
4. Review network/firewall

### Data Not Showing in Dashboard
1. Verify backend receiving data (check logs)
2. Check database for inserted records
3. Verify frontend API calls
4. Check authentication token

### High Memory Usage
1. Check for memory leaks in monitoring loop
2. Verify data batching working
3. Review sysinfo crate usage

---

**Testing Status**: Ready for execution  
**Last Updated**: December 2025
