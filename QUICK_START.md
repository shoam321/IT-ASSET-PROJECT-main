# 🚀 Quick Start Guide - IT Asset System Tray Agent

## Prerequisites Check
- [ ] Rust installed: `rustc --version`
- [ ] Node.js installed: `node --version`
- [ ] PostgreSQL database running
- [ ] Backend server accessible

---

## 5-Minute Setup

### 1️⃣ Database Setup (1 min)
```powershell
# Navigate to project root
cd "c:\Users\shoam\Downloads\IT-ASSET-PROJECT-main\IT-ASSET-PROJECT-main"

# Apply database migration
psql -U your_username -d your_database -f itam-saas/Agent/migrations/add-usage-tracking.sql
```

### 2️⃣ Build Agent (2 min)
```powershell
# Option A: Use build script
.\build-agent.ps1

# Option B: Manual build
cd itam-saas/TauriAgent
npm install
npm run tauri build
```

### 3️⃣ Configure Agent (1 min)
Edit `itam-saas/TauriAgent/src-tauri/config.json`:
```json
{
  "api": {
    "url": "http://localhost:5000"
  }
}
```

### 4️⃣ Test Agent (1 min)
```powershell
cd itam-saas/TauriAgent
npm run tauri dev
```

✅ **Done!** Agent should appear in system tray.

---

## Quick Test

### Test Backend API
```powershell
# Test heartbeat endpoint
$token = "YOUR_JWT_TOKEN"
$body = @{
    device_id = "test-001"
    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/agent/heartbeat" `
  -Method POST `
  -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} `
  -Body $body
```

### View Dashboard
1. Open browser: `http://localhost:3000`
2. Login with credentials
3. Navigate to "Usage Monitor"
4. See your test device!

---

## Troubleshooting

**Agent won't build?**
```powershell
# Install Rust
winget install rustlang.rust.msvc

# Or via rustup
# https://rustup.rs/
```

**Can't connect to API?**
- Check `config.json` API URL
- Verify backend is running: `http://localhost:5000/health`
- Check firewall settings

**Database errors?**
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('devices', 'device_usage');
```

---

## Production Deployment

### Build Installer
```powershell
cd itam-saas/TauriAgent
npm run tauri build
```

Installer location:
```
itam-saas/TauriAgent/src-tauri/target/release/bundle/msi/tauriagent_0.1.0_x64_en-US.msi
```

### Deploy to Users
```powershell
# Silent install
msiexec /i tauriagent_0.1.0_x64_en-US.msi /quiet /norestart
```

---

## What's Next?

✅ **Read full docs**: [AGENT_IMPLEMENTATION_SUMMARY.md](AGENT_IMPLEMENTATION_SUMMARY.md)  
✅ **Testing guide**: [TESTING_GUIDE.md](TESTING_GUIDE.md)  
✅ **Deployment**: [itam-saas/TauriAgent/DEPLOYMENT.md](itam-saas/TauriAgent/DEPLOYMENT.md)

---

**Need help?** Check the comprehensive documentation or review the testing guide.
