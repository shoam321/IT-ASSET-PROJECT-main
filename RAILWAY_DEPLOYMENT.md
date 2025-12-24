# Deploy Backend to Railway

## Step-by-Step Deployment Guide

### Prerequisites
- GitHub account with your code pushed
- Railway account (railway.app)

### Step 1: Connect Railway to GitHub

1. Go to **railway.app**
2. Log in or create account
3. Click **"+ New Project"**
4. Select **"Deploy from GitHub repo"**
5. Click **"Configure GitHub App"**
6. Select your GitHub organization/user
7. Grant access to **IT-ASSET-PROJECT** repo
8. Click **"Deploy"**

### Step 2: Configure Backend Service

Railway will detect your monorepo. You need to specify which folder is your backend:

1. After project created, click **"Add Service"** → **"GitHub Repo"**
2. Select your **IT-ASSET-PROJECT** repo
3. In **"Settings"** tab:
   - Set **Root Directory** to: `itam-saas/Agent`
   - Set **Node Environment** to: `production`

### Step 3: Add Environment Variables

1. Go to backend service → **Variables** tab
2. Add these variables:

```
DATABASE_URL=postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@postgres.railway.internal:5432/railway
PORT=5000
NODE_ENV=production
```

3. Click **"Add Variable"** for each one
4. Click **Deploy**

### Step 4: Get Your Backend URL

1. Go to backend service → **Settings** tab
2. Find **"Domains"** section
3. Copy the public domain (e.g., `https://your-service-xxxxx.up.railway.app`)
4. Save this URL

### Step 5: Update Frontend

Update your frontend to use this URL:

In `itam-saas/Client/src/services/db.js`:

```javascript
const API_URL = process.env.REACT_APP_API_URL || 'https://YOUR-RAILWAY-URL/api';
```

Replace `YOUR-RAILWAY-URL` with the domain you copied.

### Step 6: Deploy Frontend (Vercel)

1. Go to **vercel.com**
2. Click **"New Project"**
3. Select your GitHub repo: **IT-ASSET-PROJECT**
4. Set **Root Directory** to: `itam-saas/Client`
5. Add environment variable:
   - `REACT_APP_API_URL=https://YOUR-RAILWAY-URL/api`
6. Click **Deploy**

### Done! ✅

Your app will now be:
- **Backend**: Running on Railway
- **Frontend**: Running on Vercel
- **Database**: Connected via Railway PostgreSQL

---

## Troubleshooting

### Backend returning 500 errors?

Check Railway logs:
1. Go to backend service
2. Click **Logs** tab
3. Look for error messages
4. Common issues:
   - DATABASE_URL not set correctly
   - Environment variables not saved
   - Node version mismatch

### Frontend can't connect to backend?

1. Verify the API_URL in `db.js` matches your Railway domain
2. Make sure CORS is enabled in backend (already done ✅)
3. Test health endpoint: `https://YOUR-RAILWAY-URL/health`

### Need to redeploy?

Just push to GitHub:
```bash
git add .
git commit -m "Your message"
git push origin main
```

Railway will automatically redeploy!
