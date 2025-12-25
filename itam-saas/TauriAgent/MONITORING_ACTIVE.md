# ✅ Monitoring Now Active!

## What Just Happened

The agent now **actively monitors and sends data** to the backend every 2 minutes.

### Features Added

**1. Real-Time Data Collection** 📊
- Collects top 10 running processes on your device
- Captures process names and timestamps
- Automatically sends to Railway API

**2. Auto-Sync Every 2 Minutes** ⏱️
- First sync happens immediately after login
- Then syncs every 120 seconds (2 minutes)
- Shows countdown: "Last synced: 45s ago"

**3. Visual Feedback** 👁️
- **Sync Status**: Shows "Syncing...", "Active", "Error", or "Initializing..."
- **Connection Indicator**: Green dot when connected, orange when syncing
- **Last Sync Time**: Real-time countdown since last data send

## How to Test

### Step 1: Login
1. Agent should be open now
2. Login with `admin` / `SecureAdmin2025`
3. Watch for "Syncing..." status immediately

### Step 2: Check Dashboard
**In the Agent Window:**
- Top card should show: "Last synced: Xs ago" (updates every second)
- Status should change from "Syncing..." → "Active" 
- Should say "✓ Sending every 2 minutes"
- Green dot next to "Connected"

### Step 3: Verify Backend
**In Web Dashboard** (https://it-asset-project.vercel.app):
1. Go to Usage Monitor page
2. Should see new records appearing
3. Each sync sends 10 process records
4. Timestamp should match agent sync time

### Step 4: Watch It Work
- Keep agent open for 2 minutes
- Watch "Last synced" counter reset to 0
- Status briefly shows "Syncing..." then back to "Active"
- Web dashboard updates with new data

## Technical Details

### Data Flow
```
Agent (every 2 min) → Railway API → PostgreSQL → Web Dashboard
```

### What's Sent
```json
[
  {
    "appName": "chrome.exe",
    "windowTitle": "chrome.exe", 
    "duration": 120,
    "timestamp": 1703548800
  },
  // ... 9 more processes
]
```

### Rust Command
- **Function**: `collect_and_send_usage(auth_token)`
- **Location**: `lib.rs` line 120-164
- **Endpoint**: POST `/api/agent/usage`
- **Auth**: Bearer token from login

### React Hook
- **Location**: `App.jsx` line 40-62
- **Trigger**: When `isAuthenticated` and `authToken` exist
- **Interval**: 120000ms (2 minutes)
- **Cleanup**: Clears interval on logout

## Status Indicators

| Status | Meaning | Color |
|--------|---------|-------|
| Initializing... | Just logged in, preparing | Orange |
| Syncing... | Sending data now | Orange |
| Active | Data sent, waiting for next interval | Green |
| Error | Network/API error | Orange |

## Troubleshooting

**If status stays "Initializing..."**
- Check internet connection
- Verify token is valid
- Check browser console (Ctrl+Shift+I)

**If status shows "Error"**
- Backend might be down
- Check Railway API status
- Verify auth token hasn't expired

**If web dashboard doesn't update**
- Refresh the page
- Check if you're looking at the right device
- Verify agent is sending (check console logs)

---

**Build**: v0.1.0 with monitoring
**Date**: December 25, 2025
**Sync Interval**: 2 minutes (120 seconds)
