# Windows Agent - Final Setup Guide

## Current Status
✅ Backend API working
✅ Database storing data
✅ Web interface displays data
⚠️ Agent compiles but needs configuration

## To Build the Windows Agent:

### Option 1: Quick Test (Development)
1. **Update token in the agent:**
   - Get fresh token from browser console: `localStorage.getItem('token')`
   - Edit: `itam-saas\TauriAgent\src\App.jsx`
   - Line 13-18, paste your token in `auth_token: "YOUR_TOKEN_HERE"`

2. **Run agent:**
```powershell
cd itam-saas\TauriAgent
npm run tauri dev
```
This opens a desktop app that monitors activity.

### Option 2: Build Windows Installer (Production)
```powershell
cd itam-saas\TauriAgent
npm run tauri build
```

**Output:**
- MSI Installer: `src-tauri\target\release\bundle\msi\tauriagent_0.1.0_x64_en-US.msi`
- Portable EXE: `src-tauri\target\release\tauriagent.exe`

**Build time:** ~5-10 minutes (first build)

---

## What the Agent Does:

1. **Monitors Active Applications** 📱
   - Tracks which apps you're using
   - Records time spent in each app
   - Monitors window titles

2. **Sends Data to Server** 📡
   - Device heartbeat every 30 seconds
   - Usage data every 5 seconds
   - System information (OS, hostname)

3. **Runs in System Tray** 💻
   - Minimizes to tray
   - Right-click for menu
   - Shows/hides window

4. **Displays Real-time Stats** 📊
   - Current active app
   - Recent activity history
   - Connection status

---

## Alternative: Simpler Approach

If Tauri is too complex, I can create a **simpler C# .NET Windows app** that:
- Is smaller and faster to build
- Creates a simple .exe file
- Does the same monitoring
- Easier to deploy

Would you prefer:
A) Continue with Tauri (more modern, better UI)
B) Switch to C# .NET (simpler, traditional Windows app)
C) Just use PowerShell scripts (lightweight, no installation)

---

## Current Test Results:

**Devices in Database:** 2
- TEST-LT-SHOAM-TA-095200 (5 usage records)
- test-LT-SHOAM-TA-947 (1 usage record)

**Working Endpoints:**
✅ POST /api/agent/heartbeat
✅ POST /api/agent/usage
✅ GET /api/agent/devices
✅ GET /api/agent/devices/{id}/usage

---

## Recommended Next Step:

**BUILD THE INSTALLER NOW:**
```powershell
cd c:\Users\shoam\Downloads\IT-ASSET-PROJECT-main\IT-ASSET-PROJECT-main\itam-saas\TauriAgent
npm run tauri build
```

This creates a .msi installer you can distribute to other computers!
