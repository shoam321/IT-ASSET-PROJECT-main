# Testing the IT Asset Agent

## Quick Start - Testing the Agent

### Option 1: Development Mode (Recommended for Testing)

1. **Navigate to TauriAgent folder:**
```powershell
cd c:\Users\shoam\Downloads\IT-ASSET-PROJECT-main\IT-ASSET-PROJECT-main\itam-saas\TauriAgent
```

2. **Update the API configuration:**
   - Open `src/App.jsx`
   - Change the `api_url` in the config object to your production URL:
   ```javascript
   const config = {
     api_url: "https://it-asset-project-production.up.railway.app/api",
     auth_token: "YOUR_AUTH_TOKEN_HERE", // Get this from localStorage after logging in
     device_id: "device_" + Math.random().toString(36).substr(2, 9),
     poll_interval: 5,
   };
   ```

3. **Get your auth token:**
   - Log into your web app at https://it-asset-project.vercel.app
   - Open browser DevTools (F12) → Console
   - Type: `localStorage.getItem('token')`
   - Copy the token value

4. **Run in development mode:**
```powershell
npm run tauri dev
```

This will:
- ✅ Open the agent window
- ✅ Start monitoring active applications
- ✅ Send usage data to your backend every 5 seconds
- ✅ Show real-time activity in the agent UI

---

### Option 2: Quick Test Without Building

If you just want to test the API endpoints without the full agent:

1. **Test device registration:**
```powershell
$token = "YOUR_AUTH_TOKEN_HERE"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Send heartbeat
$body = @{
    device_id = "test-device-123"
    timestamp = [int][double]::Parse((Get-Date -UFormat %s))
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://it-asset-project-production.up.railway.app/api/agent/heartbeat" -Method POST -Headers $headers -Body $body
```

2. **Send test usage data:**
```powershell
$usageData = @{
    device_id = "test-device-123"
    app_name = "Visual Studio Code"
    window_title = "Testing Agent"
    duration = 60
    timestamp = [int][double]::Parse((Get-Date -UFormat %s))
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://it-asset-project-production.up.railway.app/api/agent/usage" -Method POST -Headers $headers -Body $usageData
```

3. **Check if device appears:**
   - Go to Usage Monitor in your web app
   - You should see "test-device-123" listed

---

### Option 3: Build Production Version

1. **Build the installer:**
```powershell
cd c:\Users\shoam\Downloads\IT-ASSET-PROJECT-main\IT-ASSET-PROJECT-main\itam-saas\TauriAgent
npm run tauri build
```

2. **Install:**
   - Find the MSI installer in: `src-tauri/target/release/bundle/msi/`
   - Or the portable EXE in: `src-tauri/target/release/tauriagent.exe`

3. **Run the installed agent**
   - It will run in the system tray
   - Right-click the tray icon to show/hide

---

## Troubleshooting

### Agent can't connect to API
- Verify your auth token is valid
- Check the API URL is correct
- Ensure your firewall allows outbound connections

### No devices showing in Usage Monitor
- Check browser console for errors
- Verify the agent is running (`npm run tauri dev`)
- Check that heartbeat is being sent successfully

### Agent crashes on startup
- Make sure you have Visual Studio Build Tools installed (Windows)
- Try: `npm install` again
- Check Rust is up to date: `rustup update`

---

## What Gets Monitored

The agent tracks:
- 📱 Active application name
- 🕐 Time spent in each application
- 💻 System information (OS, hostname)
- 🔄 Device heartbeat (online status)

Data is sent to the backend every 5 seconds and stored in the PostgreSQL database.
