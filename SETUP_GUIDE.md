# IT Asset Project - Setup & Troubleshooting Guide

## Prerequisites
- Node.js (v14+)
- PostgreSQL (running)
- Git

## Quick Start (One-Time Setup)

### 1. Install Dependencies

```bash
# Install backend dependencies
cd itam-saas/Agent
npm install

# Install frontend dependencies (from project root)
cd ../Client
npm install
```

### 2. Configure Environment Variables

**Backend (.env file in itam-saas/Agent/):**
```
DATABASE_URL=postgresql://username:password@localhost:5432/your_database
PORT=5000
REACT_APP_URL=http://localhost:3000
```

## Running the Application

### Option A: Run Separately (Recommended for Development)

**Terminal 1 - Start Backend:**
```bash
cd itam-saas/Agent
npm start
```
✅ Wait for this message:
```
🚀 IT Asset Tracker Server running on http://localhost:5000
```

**Terminal 2 - Start Frontend:**
```bash
cd itam-saas/Client
npm start
```
✅ Wait for this message:
```
Compiled successfully!
You can now view itam-tracker-client in the browser.
  Local:            http://localhost:3000
```

### Option B: Run with Concurrently (Optional)

From project root:
```bash
npm run dev
```

## Troubleshooting

### ❌ "Failed to load assets. Make sure the backend server is running on port 5000"

**Solution Steps:**
1. **Check if backend is running:**
   ```bash
   curl http://localhost:5000/health
   ```
   - If you get `{"status":"ok"}` → Backend is running ✅
   - If connection refused → Backend is NOT running ❌

2. **If backend is not running:**
   ```bash
   cd itam-saas/Agent
   npm start
   ```

3. **Check database connection:**
   - Verify PostgreSQL is running
   - Check DATABASE_URL in .env file
   - Verify database exists

4. **Check port 5000 is free:**
   ```powershell
   netstat -ano | findstr :5000
   ```
   - If something is using it, either:
     - Kill the process: `taskkill /PID <process_id> /F`
     - Or change PORT in .env to 5001, etc.

### ❌ Database Tables Not Found

After making database changes:

1. **Verify tables exist in database:**
   - Open DBeaver
   - Check PostgreSQL → Your Database → Schemas → public → Tables
   - You should see: assets, contracts, licenses, users

2. **Restart the backend:**
   ```bash
   # Stop: Press Ctrl+C in the terminal running backend
   # Start: npm start
   ```

3. **Clear frontend cache (if needed):**
   - In browser: Press F12 → Application → Clear Site Data
   - Refresh page: Ctrl+F5

### ❌ Port 3000 Already in Use

```powershell
netstat -ano | findstr :3000
taskkill /PID <process_id> /F
```

### ❌ npm start gives errors

```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -r node_modules package-lock.json
npm install

# Try again
npm start
```

## Database Verification

To verify your database is working:

1. **Check database tables:**
   ```bash
   cd itam-saas/Agent
   node -e "
   import pool from './db.js';
   const result = await pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \"public\" ORDER BY table_name');
   console.log('Tables:', result.rows.map(r => r.table_name));
   process.exit(0);
   " --input-type=module
   ```

2. **Check health endpoint:**
   ```bash
   curl http://localhost:5000/health
   ```

## File Structure
```
IT ASSET PROJECT/
├── itam-saas/
│   ├── Agent/          (Backend - Node.js/Express)
│   │   ├── server.js   (Main server file)
│   │   ├── queries.js  (Database queries)
│   │   ├── db.js       (Database connection)
│   │   └── .env        (Environment variables)
│   └── Client/         (Frontend - React)
│       ├── src/
│       ├── public/
│       └── package.json
├── SETUP_GUIDE.md      (This file)
└── README.md
```

## Regular Workflow

### Making Database Changes:
1. Make changes in DBeaver or SQL
2. Restart backend: `Ctrl+C` then `npm start`
3. Refresh frontend: `Ctrl+F5`

### Adding/Editing/Deleting Data:
1. Make sure both backend and frontend are running
2. Use the UI or API endpoints
3. Changes appear in DBeaver automatically

### Deploying:
1. Test locally with both servers running
2. `git add .`
3. `git commit -m "Your message"`
4. `git push origin main`
5. Deploy to production

## Useful Commands

```bash
# Check backend health
curl http://localhost:5000/health

# View backend logs (if running with npm start)
# Logs appear in terminal where backend is running

# Check if ports are in use
netstat -ano | findstr :5000  # Backend
netstat -ano | findstr :3000  # Frontend
netstat -ano | findstr :5432  # PostgreSQL

# Kill process on port (Windows)
taskkill /PID <number> /F

# Kill process on port (Mac/Linux)
lsof -ti:5000 | xargs kill -9
```

## Support

If problems persist:
1. Check error messages in backend terminal
2. Check browser console (F12)
3. Verify database connection in DBeaver
4. Make sure PostgreSQL service is running
5. Check logs for specific error codes
