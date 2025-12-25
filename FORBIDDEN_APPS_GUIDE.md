# 🚫 Forbidden App Detection System - Quick Start Guide

## ✅ System Status

**Completed Features:**
- ✅ Database schema with triggers
- ✅ Backend API with 9 new endpoints
- ✅ Real-time WebSocket notifications
- ✅ Rust agent with process scanning
- ✅ React dashboard with live alerts
- ✅ Toast notifications

---

## 🚀 Getting Started

### **Step 1: Run Database Migration**

```bash
# Connect to your PostgreSQL database
psql -U your_user -d your_database -f itam-saas/Agent/migrations/add-forbidden-apps.sql
```

This creates:
- `forbidden_apps` table
- `security_alerts` table
- PostgreSQL NOTIFY triggers
- Default forbidden apps (mimikatz, nmap, torrent, etc.)

### **Step 2: Start Backend Server**

```bash
cd itam-saas/Agent
npm install  # Install socket.io if not done
node server.js
```

You should see:
```
✅ Database initialized successfully
✅ Alert Service initialized successfully
🚀 IT Asset Tracker Server running on http://localhost:5000
🔌 WebSocket ready for real-time alerts
```

### **Step 3: Start Frontend Dashboard**

```bash
cd itam-saas/Client  
npm install  # Install socket.io-client and react-toastify if not done
npm start
```

Dashboard will open at `http://localhost:3000`

### **Step 4: Build & Run Tauri Agent**

```bash
cd itam-saas/TauriAgent/src-tauri
cargo build --release
```

Then run:
```bash
..\target\release\tauriagent.exe
```

Or use the deployment package:
```bash
cd itam-saas/TauriAgent
.\create-deployment-package.ps1
.\deployment\tauriagent.exe
```

---

## 📱 How to Use

### **Admin: Managing Forbidden Apps**

1. Login to dashboard at https://it-asset-project.vercel.app
2. Click **"Forbidden Apps"** in sidebar
3. Click **"➕ Add New"**
4. Enter:
   - **Process Name**: e.g., `poker.exe` (case-insensitive)
   - **Description**: Why it's forbidden
   - **Severity**: Low, Medium, High, or Critical
5. Click **"✅ Add to Forbidden List"**

### **Viewing Security Alerts**

1. Click **"Security Alerts"** in sidebar
2. See real-time dashboard with:
   - Total alerts
   - New alerts
   - Critical count
   - Last 24h activity
3. Filter by status: New, Acknowledged, Resolved, False Positive
4. Take action on alerts:
   - **Acknowledge** - Mark as seen
   - **Resolve** - Issue handled
   - **False Positive** - Not actually a violation

### **Agent: Automatic Detection**

The Tauri agent automatically:
1. **Fetches forbidden list** every 5 minutes
2. **Scans running processes** every 60 seconds
3. **Reports violations** to server immediately
4. **Caches list locally** (works offline)
5. **Avoids duplicates** (won't alert on same PID twice)

---

## 🔔 Real-Time Notifications

When a forbidden app is detected:

1. **Agent** → Finds violation, sends to API
2. **Database** → Trigger fires, sends PostgreSQL NOTIFY
3. **Alert Service** → Receives notification, broadcasts via WebSocket
4. **Dashboard** → Shows toast notification with sound
5. **Admin** → Sees alert in real-time, can take action

---

## 🧪 Testing the System

### **Test 1: Add Forbidden App**

```bash
# In dashboard, add "notepad.exe" as forbidden (for testing)
# Severity: Low
```

### **Test 2: Trigger Detection**

```bash
# On machine with agent running, open Notepad
notepad.exe
```

### **Test 3: Verify Alert**

Within 60 seconds:
- ✅ Dashboard shows toast notification
- ✅ Alert appears in "Security Alerts" table
- ✅ Status shows "New"
- ✅ WebSocket indicator shows "🟢 Live"

### **Test 4: Resolve Alert**

1. Click **"✔️ Acknowledge"** button
2. Status changes to "Acknowledged"
3. Click **"✅ Resolve"** to close

---

## 🔧 Troubleshooting

### **No Alerts Showing?**

- Check agent is running: Look for system tray icon
- Check WebSocket connection: Should show "🟢 Live" in dashboard
- Check backend logs: Should see "🚨 Security alert created"
- Verify forbidden list synced: Agent logs show "✅ Synced X forbidden apps"

### **Agent Not Detecting?**

- Process name must match exactly (case-insensitive)
- Wait 60 seconds for next scan cycle
- Check forbidden list cached: `%APPDATA%\tauriagent\forbidden_cache.json`
- Verify process is running when scanned

### **WebSocket Not Connecting?**

- Check CORS settings in server.js
- Verify Railway URL in frontend
- Check browser console for connection errors
- Try refreshing the page

---

## 📊 API Endpoints Reference

### **Forbidden Apps**
- `GET /api/forbidden-apps` - List all (admin)
- `GET /api/forbidden-apps/list` - Lightweight (for agent sync)
- `POST /api/forbidden-apps` - Add new (admin only)
- `DELETE /api/forbidden-apps/:id` - Remove (admin only)

### **Security Alerts**
- `POST /api/alerts` - Report violation (from agent)
- `GET /api/alerts` - List all alerts
- `GET /api/alerts/stats` - Get statistics
- `PATCH /api/alerts/:id` - Update status (admin only)
- `GET /api/alerts/device/:deviceId` - Device-specific alerts

### **WebSocket**
- **Connect**: `io(API_URL)`
- **Event**: `security-alert` - Real-time alert broadcast

---

## 🎯 Default Forbidden Apps

Pre-installed in the database:

| Process Name | Risk Level | Description |
|-------------|-----------|-------------|
| `mimikatz.exe` | Critical | Password dumping tool |
| `nmap.exe` | High | Network scanning |
| `wireshark.exe` | High | Packet analyzer |
| `torrent.exe` | Medium | BitTorrent client |
| `utorrent.exe` | Medium | BitTorrent client |
| `poker.exe` | Low | Gambling software |
| `steam.exe` | Low | Gaming platform |

---

## 🔐 Security Features

- **JWT Authentication**: All API calls require valid token
- **Row-Level Security**: Users see only their own alerts
- **Admin-Only Management**: Only admins can add/remove forbidden apps
- **Duplicate Prevention**: Same process won't generate multiple alerts
- **Offline Caching**: Agent works even if API is unreachable

---

## 📈 Next Steps (Optional Enhancements)

1. **File Hash Checking** - Match by hash, not just name
2. **Auto-Kill Process** - Remote termination from dashboard
3. **Email Notifications** - Alert security team on Critical severity
4. **Weekly Reports** - Automated digest emails
5. **Machine Learning** - Detect anomalous process behavior
6. **Mobile App** - iOS/Android dashboard for on-the-go monitoring

---

## 🎉 System is Ready!

Everything is configured and operational. Start monitoring your network for forbidden applications in real-time!

**Support**: Check console logs for detailed debugging information.
