# IT Asset Agent - Deployment Guide

## Overview
The IT Asset Agent is a lightweight system tray application that monitors device activity and sends usage data to the central IT Asset Management system.

## Prerequisites

### For Building
- **Rust** (latest stable): https://rustup.rs/
- **Node.js** (v16+): https://nodejs.org/
- **Tauri CLI**: Installed via npm
- **Visual Studio Build Tools** (Windows): For native compilation

### For Running
- Windows 10/11 (64-bit)
- ~10MB RAM
- Network access to the IT Asset Management API

## Building the Agent

### 1. Install Dependencies

```powershell
cd itam-saas/TauriAgent
npm install
```

### 2. Development Mode

Run the agent in development mode with hot-reload:

```powershell
npm run tauri dev
```

### 3. Production Build

Build the installer for distribution:

```powershell
npm run tauri build
```

This creates:
- **MSI Installer**: `src-tauri/target/release/bundle/msi/tauriagent_0.1.0_x64_en-US.msi`
- **Portable EXE**: `src-tauri/target/release/tauriagent.exe`

## Distribution

### MSI Installer (Recommended)

1. Navigate to the MSI file location
2. Distribute via:
   - **Group Policy**: Deploy through Windows Domain
   - **SCCM/Intune**: Use Microsoft Endpoint Manager
   - **Manual Install**: Share MSI file directly

### Installation Command (Silent)

```powershell
msiexec /i tauriagent_0.1.0_x64_en-US.msi /quiet /norestart
```

## Configuration

### API Endpoint Setup

Before deploying, update the API URL in `src-tauri/config.json`:

```json
{
  "api": {
    "url": "https://your-api-domain.com",
    "timeout": 30000
  }
}
```

### Auto-Start Configuration

The agent can be configured to start automatically on user login:

1. **Enable via UI**: Right-click system tray → Settings → Enable Auto-Start
2. **Enable via config**: Set `"auto_start": true` in config.json

## Features

### Real-Time Monitoring
- ✅ Active application tracking
- ✅ Window title capture
- ✅ Usage duration logging
- ✅ 5-second polling interval

### Data Transmission
- ✅ Secure API communication (JWT)
- ✅ Automatic retry on failure
- ✅ Heartbeat every 30 seconds
- ✅ Batch data upload every 60 seconds

### System Tray Integration
- ✅ Minimize to system tray
- ✅ Show/Hide window
- ✅ Status indicators
- ✅ Quick access menu

## Security

### Authentication
The agent requires a valid JWT token to communicate with the API. Tokens should be:
- Generated server-side
- Stored securely in local storage
- Rotated regularly

### Data Privacy
- Only application names and window titles are collected
- No file content or personal data is transmitted
- All communication is encrypted (HTTPS)

## Troubleshooting

### Agent Not Starting
1. Check if Rust dependencies are installed
2. Verify Windows Defender hasn't blocked the executable
3. Check Event Viewer for crash logs

### Not Connecting to API
1. Verify API URL in config.json
2. Check network connectivity
3. Ensure JWT token is valid
4. Check firewall settings

### High CPU Usage
- Normal CPU usage: <1%
- If higher, check polling interval in config
- Verify system has adequate resources

## Monitoring Agent Status

### From the Dashboard
Navigate to **Usage Monitor** in the web dashboard to see:
- Active devices
- Last seen timestamp
- Connection status
- Usage statistics

### Logs Location
- **Windows**: `%APPDATA%/tauriagent/logs/`
- **Development**: Console output

## Uninstallation

### Via Control Panel
1. Open Settings → Apps
2. Find "tauriagent"
3. Click Uninstall

### Via Command Line
```powershell
msiexec /x tauriagent_0.1.0_x64_en-US.msi /quiet
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Memory Usage | ~8-10 MB |
| CPU Usage | <1% |
| Network Usage | ~1 KB/min |
| Disk Space | ~15 MB |

## Update Process

1. Build new version with incremented version number
2. Deploy via same distribution method
3. Agent will auto-update on next restart (if configured)

## Support

For issues or questions:
- Check logs in `%APPDATA%/tauriagent/logs/`
- Contact IT Support
- Review documentation at the main project README

---

**Version**: 0.1.0  
**Last Updated**: December 2025  
**Platform**: Windows 10/11
