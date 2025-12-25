# Quick Fix: Set Vercel Environment Variable

## The Problem
Your Vercel deployment is missing the backend API URL configuration, causing all API calls to fail with 404 errors.

## The Solution
Add the environment variable to Vercel (takes 2 minutes):

### Step-by-Step Instructions:

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Login if needed

2. **Select Your Project**
   - Find and click on "it-asset-project"

3. **Add Environment Variable**
   - Click "Settings" tab
   - Click "Environment Variables" in left sidebar
   - Click "Add New" button
   - Fill in:
     - **Key**: `REACT_APP_API_URL`
     - **Value**: `https://it-asset-project-production.up.railway.app`
     - **Environments**: Check all boxes (Production, Preview, Development)
   - Click "Save"

4. **Redeploy**
   - Click "Deployments" tab at top
   - Find the latest deployment
   - Click the three dots menu (⋯) on the right
   - Click "Redeploy"
   - Wait for deployment to complete (~2 minutes)

5. **Test**
   - Visit: https://it-asset-project.vercel.app
   - Login: admin / admin123
   - You should now see your data (Assets, Users, Licenses, Contracts)
   - Navigate to "Forbidden Apps" - you should see 7 apps

## Why This Works

- The frontend code is already correct ✅
- The backend (Railway) is working ✅
- The database has all the tables ✅
- The ONLY missing piece is telling Vercel where the backend is!

## Verification

After redeploying, open browser DevTools (F12) and check the Console:
- ✅ Should see successful API calls to `it-asset-project-production.up.railway.app`
- ❌ Should NOT see 404 errors

## Note
The local version is already running on http://localhost:3000 and works perfectly because the `.env` file exists locally. Vercel needs the environment variable configured separately.
