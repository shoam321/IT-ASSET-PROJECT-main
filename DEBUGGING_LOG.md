# Debugging Log: Tauri Agent & Web Dashboard Integration

**Date:** December 25, 2025  
**Objective:** Connect Tauri Windows agent to web dashboard to display real-time device monitoring data

---

## Issue #1: Agent Not Sending Data to Backend

### Problem
Agent showed "Connection issue" and "Error" status. No data appearing in web dashboard.

### Investigation
- Agent login worked successfully ✓
- Agent showed friendly UI ✓
- But monitoring loop never started sending data ✗

### Root Cause
The monitoring functionality existed in code but **never actually sent data every 2 minutes**. The agent had no automatic data collection loop.

### Fix Applied
**File:** `itam-saas/TauriAgent/src-tauri/src/lib.rs`

Added new Rust command `collect_and_send_usage()`:
```rust
#[tauri::command]
async fn collect_and_send_usage(auth_token: String) -> Result<String, String> {
    let mut sys = System::new_all();
    sys.refresh_processes();
    
    let client = reqwest::Client::new();
    let url = "https://it-asset-project-production.up.railway.app/api/agent/usage";
    
    // Get device info for device_id
    let hostname = System::host_name().unwrap_or_else(|| "unknown".to_string());
    let device_id = hostname.clone();
    
    let timestamp = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    // Send usage records one by one (API expects individual records)
    let mut success_count = 0;
    let processes: Vec<_> = sys.processes().iter().take(10).collect();
    
    for (_, process) in processes {
        let usage_data = serde_json::json!({
            "device_id": device_id,
            "app_name": process.name().to_string(),
            "window_title": process.name().to_string(),
            "duration": 120, // 2 minutes in seconds
            "timestamp": timestamp
        });
        
        let response = client
            .post(url)
            .header("Authorization", format!("Bearer {}", auth_token))
            .json(&usage_data)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        if response.status().is_success() {
            success_count += 1;
        }
    }
    
    Ok(format!("Successfully sent {} usage records", success_count))
}
```

**File:** `itam-saas/TauriAgent/src/App.jsx`

Added React useEffect to call this every 2 minutes:
```jsx
// Start monitoring after login - send data every 2 minutes
useEffect(() => {
  if (!isAuthenticated || !authToken) return;

  const sendData = async () => {
    try {
      setSyncStatus("Syncing...");
      setErrorMessage("");
      const result = await invoke('collect_and_send_usage', { authToken });
      setSyncStatus("Active");
      setLastSync(new Date());
      console.log("✅ Usage data sent:", result);
    } catch (err) {
      setSyncStatus("Error");
      setErrorMessage(String(err));
      console.error("❌ Failed to send usage data:", err);
    }
  };

  // Send immediately on login
  sendData();

  // Then send every 2 minutes (120000 ms)
  const interval = setInterval(sendData, 120000);

  return () => clearInterval(interval);
}, [isAuthenticated, authToken]);
```

**Commit:** `feat: Implement monitoring functionality with real-time data collection and auto-sync every 2 minutes`

---

## Issue #2: Backend API Returning 500 Error

### Problem
Railway HTTP logs showed:
```
POST /api/agent/usage - 500 Internal Server Error
```

Agent was sending data but backend was crashing.

### Investigation
Checked Railway logs and database schema. Found that `device_usage` table has foreign key constraint:
```sql
CREATE TABLE device_usage (
  device_id VARCHAR(255) NOT NULL,
  -- ...
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);
```

### Root Cause
**Foreign Key Violation:** Agent was trying to insert usage data for a device that didn't exist in the `devices` table yet. PostgreSQL rejected the insert.

### Fix Applied
**File:** `itam-saas/Agent/server.js`

Modified `/api/agent/usage` endpoint to auto-create device first:
```javascript
app.post('/api/agent/usage', authenticateToken, async (req, res) => {
  try {
    const { device_id, app_name, window_title, duration, timestamp } = req.body;
    
    if (!device_id || !app_name) {
      return res.status(400).json({ error: 'device_id and app_name are required' });
    }

    // ✅ FIX: Ensure device exists first (auto-create if needed)
    await db.upsertDevice({
      device_id,
      hostname: device_id,
      os_name: 'Unknown',
      os_version: 'Unknown',
      timestamp: Date.now()
    });

    // Now insert usage data
    const usageData = await db.insertUsageData({
      device_id,
      app_name,
      window_title: window_title || '',
      duration: duration || 0,
      timestamp: timestamp || Date.now()
    });

    res.status(201).json({ 
      message: 'Usage data recorded',
      data: usageData
    });
  } catch (error) {
    console.error('Error recording usage data:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Result:** Backend now auto-creates devices, preventing foreign key errors.

**Commit:** `Fix: Auto-create device before inserting usage data`

---

## Issue #3: Web Dashboard Shows "Not Authenticated"

### Problem
Web dashboard showed:
```
⚠️ Error: Not authenticated. Please log in again.
```

Even though user WAS logged in.

### Investigation
Checked localStorage and found the token WAS saved, but under different key names:
- Login saves as: `authToken`
- UsageMonitor reads as: `token`

### Root Cause
**localStorage Key Mismatch:**
```javascript
// AuthContext.jsx (Login component)
localStorage.setItem('authToken', authToken);  // Saves as 'authToken'

// UsageMonitor.jsx
const token = localStorage.getItem('token');   // Reads 'token' ❌
```

### Fix Applied
**File:** `itam-saas/Client/src/components/UsageMonitor.jsx`

Changed all 3 instances from `'token'` to `'authToken'`:
```javascript
// Before
const token = localStorage.getItem('token');

// After
const token = localStorage.getItem('authToken');
```

**Commit:** `Fix: Use correct authToken key from localStorage`

---

## Issue #4: Web Dashboard Shows "Failed to fetch devices (404)"

### Problem
After fixing authentication, dashboard showed:
```
Error: Failed to fetch devices (404)
```

API endpoints returning 404 Not Found.

### Investigation
Checked actual URLs being called in browser DevTools:
```
GET http://localhost:5000/api/agent/devices - 404
GET http://localhost:5000/api/agent/apps/usage - 404
```

**Two issues found:**
1. Using `localhost:5000` instead of Railway production URL
2. Railway API verified working (tested with PowerShell)

### Root Cause
**Wrong Default API URL:**
```javascript
// UsageMonitor.jsx
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000'; // ❌

// Login.jsx (for comparison)
const API_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api'; // ✅
```

UsageMonitor was using localhost while other components used Railway.

### Fix Applied
**File:** `itam-saas/Client/src/components/UsageMonitor.jsx`

Changed default URL to match other components:
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://it-asset-project-production.up.railway.app/api';
```

**Commit:** `Fix: UsageMonitor default API URL to Railway production`

---

## Issue #5: Double /api/ Prefix (FINAL ISSUE)

### Problem
After all previous fixes, browser console showed:
```
GET https://it-asset-project-production.up.railway.app/api/api/agent/devices - 404
GET https://it-asset-project-production.up.railway.app/api/api/agent/apps/usage - 404
```

Notice the **double `/api/api/`** - this was the smoking gun!

### Investigation
Traced URL construction:
```javascript
// Base URL (includes /api at the end)
const API_BASE_URL = 'https://it-asset-project-production.up.railway.app/api';

// Fetch call (adds /api/agent/devices)
fetch(`${API_BASE_URL}/api/agent/devices`)

// Result: https://.../api + /api/agent/devices = /api/api/agent/devices ❌
```

### Root Cause
**Inconsistent URL Pattern:**
- Login component: Base ends with `/api`, paths start with `/auth/login` → `/api/auth/login` ✅
- UsageMonitor: Base ends with `/api`, paths start with `/api/agent/...` → `/api/api/agent/...` ❌

Earlier in debugging, I added `/api` to the fetch paths thinking base URL didn't have it. This created the double prefix.

### Fix Applied
**File:** `itam-saas/Client/src/components/UsageMonitor.jsx`

Removed `/api` prefix from all fetch calls:
```javascript
// Before
fetch(`${API_BASE_URL}/api/agent/devices`)
fetch(`${API_BASE_URL}/api/agent/devices/${deviceId}/usage`)
fetch(`${API_BASE_URL}/api/agent/apps/usage`)

// After
fetch(`${API_BASE_URL}/agent/devices`)
fetch(`${API_BASE_URL}/agent/devices/${deviceId}/usage`)
fetch(`${API_BASE_URL}/agent/apps/usage`)
```

Now URLs resolve correctly:
```
https://it-asset-project-production.up.railway.app/api + /agent/devices
= https://it-asset-project-production.up.railway.app/api/agent/devices ✅
```

**Commit:** `Fix: Remove double /api prefix in UsageMonitor URLs`

---

## Summary of All Fixes

| Issue | File | Change | Why It Matters |
|-------|------|--------|----------------|
| No monitoring loop | `TauriAgent/src-tauri/src/lib.rs` | Added `collect_and_send_usage()` command | Agent needs to actively collect and send data |
| No monitoring loop | `TauriAgent/src/App.jsx` | Added useEffect with 2-min interval | React must call Rust command periodically |
| 500 Backend Error | `Agent/server.js` | Auto-create device before usage insert | Prevents foreign key violations |
| "Not authenticated" | `Client/src/components/UsageMonitor.jsx` | Changed `'token'` → `'authToken'` | Must match AuthContext's storage key |
| 404 on localhost | `Client/src/components/UsageMonitor.jsx` | Changed localhost → Railway URL | Must point to production backend |
| Double /api/ prefix | `Client/src/components/UsageMonitor.jsx` | Removed `/api` from fetch paths | Base URL already includes `/api` |

---

## Lessons Learned

### 1. **Check URL Construction Carefully**
When base URL ends with `/api`, don't add `/api` again in the path. Always verify the final constructed URL in DevTools Network tab.

### 2. **localStorage Keys Must Match**
Different components reading/writing to localStorage must use identical key names. Document these in a central config file.

### 3. **Foreign Key Constraints Need Handling**
When inserting related data, ensure parent records exist first. Use `upsert` operations to auto-create missing parents.

### 4. **Environment Variables Need Fallbacks**
Always provide production URLs as fallbacks, not localhost. This prevents issues when env vars aren't set.

### 5. **Test API Separately First**
When debugging frontend-backend issues, test the API directly (PowerShell/curl) to isolate whether the problem is frontend or backend.

### 6. **Deployment Cache Issues**
Vercel/Railway can serve cached code even after pushing. Wait for deployment to complete and use hard refresh (Ctrl+Shift+F5).

---

## Verification Commands

### Test Backend API Directly
```powershell
# Login
$loginBody = @{ username = 'admin'; password = 'SecureAdmin2025' } | ConvertTo-Json
$loginResponse = Invoke-RestMethod -Uri 'https://it-asset-project-production.up.railway.app/api/auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$token = $loginResponse.token

# Get Devices
$headers = @{ Authorization = "Bearer $token"; 'Content-Type' = 'application/json' }
$devices = Invoke-RestMethod -Uri 'https://it-asset-project-production.up.railway.app/api/agent/devices' -Method Get -Headers $headers
$devices | ConvertTo-Json -Depth 5
```

### Expected Result
```json
[
  {
    "id": 3,
    "device_id": "LT-SHOAM-TA",
    "hostname": "LT-SHOAM-TA",
    "os_name": "Unknown",
    "os_version": "Unknown",
    "last_seen": "2025-12-25T09:56:28.954Z",
    "status": "Active",
    "app_count": "31",
    "usage_records": "60",
    "last_activity": "1766656586"
  }
]
```

---

## Final Architecture

```
┌─────────────────────┐
│  Tauri Agent (PC)   │
│  - Rust Backend     │
│  - React Frontend   │
│  - Auto-login       │
│  - 2-min sync       │
└──────────┬──────────┘
           │ POST /api/agent/usage
           │ (every 2 minutes)
           ▼
┌─────────────────────┐
│  Railway Backend    │
│  - Node.js/Express  │
│  - PostgreSQL       │
│  - Auto-create dev  │
└──────────┬──────────┘
           │ GET /api/agent/devices
           │ (on page load)
           ▼
┌─────────────────────┐
│  Vercel Frontend    │
│  - React Dashboard  │
│  - Usage Monitor    │
│  - Correct API URLs │
└─────────────────────┘
```

---

## Status: ✅ WORKING

- Agent sends data every 2 minutes
- Backend stores data without errors
- Web dashboard displays devices and usage records
- All 5 critical bugs fixed
