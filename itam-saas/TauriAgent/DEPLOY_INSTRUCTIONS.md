# IT Asset Agent - Deployment Instructions

## ✅ Build Complete!

The Windows agent has been successfully built and is ready for deployment.

### 📦 Executable Location

**Standalone EXE:** `src-tauri\target\release\tauriagent.exe`

This is a fully functional, standalone Windows executable that can be distributed to any Windows computer.

### 🚀 Quick Deployment

#### Option 1: Direct Copy (Simplest)
1. Copy `tauriagent.exe` to target computer
2. Double-click to run
3. Login with your credentials
4. Agent starts monitoring automatically

#### Option 2: Create Distribution Folder
```powershell
# Run this script to create a deployment package
cd c:\Users\shoam\Downloads\IT-ASSET-PROJECT-main\IT-ASSET-PROJECT-main\itam-saas\TauriAgent
.\create-deployment-package.ps1
```

This creates a `deployment` folder with:
- tauriagent.exe
- README for end users
- Startup shortcut

### 📝 End User Instructions

**To Install:**
1. Copy `tauriagent.exe` to a folder (e.g., `C:\Program Files\IT Asset Agent\`)
2. Run the executable
3. Login with provided credentials
4. Minimize to system tray - it will continue running

**To Auto-Start with Windows:**
1. Press `Win + R`
2. Type `shell:startup` and press Enter
3. Create a shortcut to `tauriagent.exe` in that folder
4. Restart computer to test

### 🔧 Configuration

The agent connects to: `https://it-asset-project-production.up.railway.app`

To change the API endpoint, users need to login and the token will persist.

### 📊 What It Does

- Monitors active applications every 2 minutes
- Records top 10 running processes
- Sends data to central server
- Runs in system tray
- Shows real-time sync status

### ⚙️ System Requirements

- Windows 10/11 (64-bit)
- Internet connection
- Valid user credentials

### 🔍 Verification

After deployment, verify in the web dashboard:
1. Go to https://it-asset-project.vercel.app
2. Login as admin
3. Navigate to Usage Monitor
4. You should see the device appear within 2 minutes

### 🐛 Troubleshooting

**Agent won't start:**
- Check if antivirus is blocking it
- Run as administrator
- Check firewall settings

**Not syncing data:**
- Verify internet connection
- Check login credentials
- Look for error messages in agent window

**Can't see device in dashboard:**
- Wait 2 minutes for first sync
- Refresh the dashboard
- Check if logged in with correct account

### 📦 Optional: Build MSI Installer

To create a Windows Installer package (.msi), you need WiX Toolset:

1. Install WiX Toolset v3: https://wixtoolset.org/releases/
2. Add to PATH: `C:\Program Files (x86)\WiX Toolset v3.11\bin`
3. Run: `npm run tauri build`
4. MSI will be in: `src-tauri\target\release\bundle\msi\`

### ✅ Current Status

- ✅ Agent built successfully  
- ✅ EXE ready for distribution
- ✅ Backend API connected
- ✅ Data syncing working
- ✅ System tray integration active
- ⚠️ MSI installer requires WiX Toolset (optional)

The agent is fully functional and ready to deploy!
