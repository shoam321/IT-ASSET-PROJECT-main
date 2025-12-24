# Vercel Deployment Guide for IT Asset Tracker

## Overview

The IT Asset Tracker can be deployed on Vercel in two ways:

### Option A: Frontend Only on Vercel + Backend on Heroku/Railway (Recommended)
### Option B: Full Stack on Vercel

## Option A: Frontend on Vercel + Backend Separate (Recommended)

### Step 1: Deploy Frontend on Vercel

1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Import `shoam321/IT-ASSET-PROJECT` GitHub repo
4. Configure:
   - **Root Directory**: `itam-saas/Client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

5. Add Environment Variables:
   ```
   REACT_APP_API_URL=https://your-backend-url.com/api
   REACT_APP_URL=https://your-vercel-url.vercel.app
   ```

6. Click Deploy

### Step 2: Deploy Backend (Choose One)

#### Deploy on Heroku:
```bash
cd itam-saas/Agent
heroku create your-app-name
heroku config:set DATABASE_URL=postgresql://...
git push heroku main
```

#### Deploy on Railway:
1. Go to https://railway.app
2. Connect GitHub repo
3. Select `itam-saas/Agent` as root directory
4. Add DATABASE_URL environment variable
5. Deploy

#### Deploy on Render:
1. Go to https://render.com
2. Create new Web Service
3. Connect GitHub repo
4. Set:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add environment variables
5. Deploy

### Step 3: Update Frontend API URL

Once backend is deployed, update Vercel environment:
1. Go to Vercel Project Settings
2. Add `REACT_APP_API_URL=https://your-backend-url.com/api`
3. Redeploy

---

## Option B: Full Stack on Vercel (Experimental)

### Step 1: Vercel Project Setup

1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Import `shoam321/IT-ASSET-PROJECT`
4. Configure:
   - **Root Directory**: (leave empty)
   - **Build Command**: `cd itam-saas/Client && npm install && npm run build`
   - **Output Directory**: `itam-saas/Client/build`

### Step 2: Environment Variables

Add these in Vercel Project Settings:
```
DATABASE_URL=postgresql://user:password@host:5432/db
REACT_APP_API_URL=https://your-vercel-url.vercel.app/api
REACT_APP_URL=https://your-vercel-url.vercel.app
NODE_ENV=production
```

### Step 3: Deploy

Click "Deploy" and monitor build logs.

---

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure `package.json` has all dependencies
- Verify Node version (18+ recommended)
- Check for missing environment variables

### 404 Errors
- Verify API_URL is correct
- Check CORS settings in backend
- Ensure backend is running and accessible
- Check network tab in browser DevTools

### Database Connection Error
- Verify DATABASE_URL is correct
- Check Supabase IP whitelist
- Ensure database tables exist
- Test connection locally first

### CORS Issues
- Update backend CORS origin to match frontend URL
- Add frontend domain to allowed origins

---

## Environment Variables Needed

### Frontend (.env)
```
REACT_APP_API_URL=https://backend-url.com/api
REACT_APP_URL=https://frontend-url.vercel.app
```

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@host:5432/database
PORT=5000
NODE_ENV=production
REACT_APP_URL=https://frontend-url.vercel.app
```

---

## Commands for Local Testing

```bash
# Terminal 1 - Backend
cd itam-saas/Agent
npm install
npm start

# Terminal 2 - Frontend
cd itam-saas/Client
npm install
npm start
```

Visit http://localhost:3000

---

## Next Steps

1. Deploy backend first (Heroku/Railway/Render)
2. Get backend URL
3. Deploy frontend to Vercel with backend URL
4. Test all operations
5. Add custom domain
6. Set up monitoring

## Support

For deployment issues:
- Check backend logs
- Check Vercel build logs
- Check browser console for errors
- Verify environment variables are set
- Test API directly with curl/Postman

