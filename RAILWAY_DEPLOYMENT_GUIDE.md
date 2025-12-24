# Railway Backend Deployment - Step by Step Guide

## Step 1: Go to Railway Website
1. Open https://railway.app in your browser
2. Click **"Login"** (top right)
3. Click **"Login with GitHub"**
4. Authorize Railway to access your GitHub account

## Step 2: Create New Project
1. After logging in, click **"+ New Project"**
2. Select **"Deploy from GitHub repo"**
3. Find and click on **"IT-ASSET-PROJECT"** repository

## Step 3: Configure the Deployment
1. Railway will ask you to select a root directory
2. Select: **`itam-saas/Agent`** (this is where your backend code is)
3. Click **"Deploy"** or **"Continue"**

## Step 4: Add Environment Variables
1. Once the deployment starts, go to the **"Variables"** tab
2. Click **"+ Add Variable"**
3. Add these variables one by one:

### Variable 1:
- **Key:** `DATABASE_URL`
- **Value:** `postgresql://postgres:Le%24hem%40023@db.mqizpxxcuhpldpthacxk.supabase.co:5432/postgres`
- Click **"Add"**

### Variable 2:
- **Key:** `NODE_ENV`
- **Value:** `production`
- Click **"Add"**

### Variable 3:
- **Key:** `PORT`
- **Value:** `5000`
- Click **"Add"**

## Step 5: Wait for Deployment
1. Go to the **"Deployments"** tab
2. Wait for the status to show **"✓ Success"** (green checkmark)
3. This usually takes 2-5 minutes

## Step 6: Get Your Public URL
1. Once deployed successfully, go to the **"Settings"** tab
2. Look for **"Domains"** section
3. You'll see a URL like: `https://it-asset-project-xxxxx.railway.app`
4. **Copy this URL** - you'll need it for the next step!

## Step 7: Update Vercel with the Railway URL
1. Go to https://vercel.com and log in
2. Click on your **"it-asset-project"** project
3. Go to **"Settings"** → **"Environment Variables"**
4. Add a new variable:
   - **Name:** `REACT_APP_API_URL`
   - **Value:** `https://your-railway-url/api` (replace with your actual Railway URL from Step 6)
   - Click **"Save"**
5. Go to **"Deployments"** and click **"Redeploy"** on the latest deployment

## Step 8: Test It!
1. Go to https://it-asset-project.vercel.app
2. Try adding an asset
3. If it works, you're done! 🎉

---

## If Something Goes Wrong:

**Railway deployment failed?**
- Go to Deployments tab and check the build logs
- Look for error messages

**Can't find environment variables in Railway?**
- Click on your project name
- Make sure you're on the correct tab

**Vercel still shows 404?**
- Wait 5 minutes for Vercel to redeploy
- Refresh the page (Ctrl+Shift+Delete to clear cache)

