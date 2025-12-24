# IT Asset Project - Workflow Procedure

## 🎯 Standard Workflow When Making Database Changes

### Step 1: Make Database Changes
- Open DBeaver
- Connect to your PostgreSQL database
- Make changes (insert, update, delete, add column, etc.)
- Changes are saved immediately ✅

### Step 2: Restart Backend (IMPORTANT!)
The backend caches some database info. To ensure it picks up your changes:

```powershell
# In the terminal where backend is running:
# Press Ctrl+C to stop it

# Then start it again:
.\start-backend.ps1
```

Wait for this message:
```
🚀 IT Asset Tracker Server running on http://localhost:5000
✅ All required database tables verified successfully
```

### Step 3: Refresh Frontend
In your browser:
```
Ctrl+F5  (Hard refresh to clear cache)
```
Or:
- Open DevTools (F12)
- Right-click refresh button → Empty cache and hard refresh

### Step 4: Test the Changes
- Try adding/editing/deleting data through the UI
- Verify it appears in DBeaver
- Check for errors in browser console (F12)

---

## 🚀 Complete Startup Procedure (Every Time You Work)

### Initial Setup (First Time Only)

```powershell
# 1. Open PowerShell and navigate to project
cd "C:\Users\Oshrat Shahrur\Desktop\IT ASSET PROJECT"

# 2. Verify database is running (via DBeaver or PostgreSQL service)
# 3. Open 2 more PowerShell terminals (will have 3 total)
```

### Each Work Session

**Terminal 1 - Backend:**
```powershell
.\start-backend.ps1
```
Wait for: `🚀 IT Asset Tracker Server running on http://localhost:5000`

**Terminal 2 - Frontend:**
```powershell
.\start-frontend.ps1
```
Wait for: `Compiled successfully! You can now view itam-tracker-client in the browser`

**Terminal 3 - Git/Development:**
```powershell
# For making code changes, committing, etc.
git status
git add .
git commit -m "Your message"
git push origin main
```

---

## ❌ Error: "Failed to load assets. Make sure the backend server is running on port 5000"

### Quick Fix Checklist:

1. **Is backend terminal showing the green messages?**
   ```
   ✅ Yes → Problem might be elsewhere (check #2)
   ❌ No → Backend is not running, run .\start-backend.ps1
   ```

2. **Check backend is healthy:**
   ```powershell
   # In Terminal 3, run:
   curl http://localhost:5000/health
   
   # Should show: {"status":"ok",...}
   ```

3. **Is port 5000 in use by something else?**
   ```powershell
   netstat -ano | findstr :5000
   
   # If something is there, kill it:
   taskkill /PID <process_id> /F
   ```

4. **Clear frontend cache and refresh:**
   - Press F12 (open DevTools)
   - Click Application tab
   - Click "Clear site data"
   - Close DevTools (F12)
   - Press Ctrl+F5 (hard refresh)

5. **Still not working?**
   ```powershell
   # Run diagnostics:
   .\diagnose.ps1
   ```

---

## 📊 Making Database Changes - Full Example

### Scenario: Add a new column to assets table

**Step 1: Open DBeaver and add column**
- Right-click `assets` table
- Alter Table
- Add column: `purchase_date DATE`
- Save

**Step 2: Restart Backend**
```powershell
# In Terminal 1 (where backend is running):
Ctrl+C  # Stop backend
.\start-backend.ps1  # Start it again
# Wait for: ✅ All required database tables verified successfully
```

**Step 3: Refresh Frontend**
```
Ctrl+F5 in browser
```

**Step 4: Update UI Form (if needed)**
- Open `itam-saas/Client/src/App.jsx`
- Find the asset form
- Add new field for purchase_date
- Save file (frontend auto-reloads)

**Step 5: Commit Changes**
```powershell
# Terminal 3:
git add .
git commit -m "Add purchase_date field to assets"
git push origin main
```

---

## 🔧 Advanced Troubleshooting

### Backend won't start:
```powershell
# Clear npm cache
npm cache clean --force

# Reinstall
cd itam-saas/Agent
rm node_modules -r
rm package-lock.json
npm install
npm start
```

### Frontend keeps crashing:
```powershell
# Similar fix
cd itam-saas/Client
rm node_modules -r
rm package-lock.json
npm install
npm start
```

### Database connection error:
1. Check `.env` file has correct DATABASE_URL
2. Verify PostgreSQL is running
3. Verify database exists
4. Restart backend after verifying DB

### Data not showing up:
1. Backend must be running (check Terminal 1)
2. Frontend must be running (check Terminal 2)
3. Hard refresh browser: Ctrl+F5
4. Check browser console (F12) for errors

---

## 📝 Checklist Before Each Session

- [ ] PostgreSQL service is running
- [ ] Both Terminal 1 (Backend) and Terminal 2 (Frontend) show success messages
- [ ] Browser shows app at http://localhost:3000
- [ ] DBeaver is connected to database
- [ ] No errors in browser console (F12)

---

## 🎓 Key Points to Remember

1. **Backend must be running** for ANY data operations
2. **Restart backend after ANY database changes** in DBeaver
3. **Hard refresh browser** (Ctrl+F5) after code or DB changes
4. **Always use the provided scripts** (start-backend.ps1, start-frontend.ps1)
5. **Check the success messages** - don't assume it's working
6. **Use diagnose.ps1** if something seems broken

---

## 📞 Getting Help

If things break:
1. Run: `.\diagnose.ps1` to see what's running
2. Check browser console: F12
3. Check backend terminal for errors
4. Try: Stop everything, close terminals, start fresh
5. Last resort: Clear node_modules and reinstall
