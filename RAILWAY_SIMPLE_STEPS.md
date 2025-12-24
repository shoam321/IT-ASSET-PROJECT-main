# Deploy Your Backend to Railway - Simple Steps

## STEP 1: Open Railway
- Go to https://railway.app
- Click **Login** (top right)
- Click **Login with GitHub**
- Let it connect your GitHub account

## STEP 2: Create Project
- Click **+ New Project**
- Click **Deploy from GitHub repo**
- Find **IT-ASSET-PROJECT** in the list
- Click on it

## STEP 3: Pick the Right Folder
- Railway will ask: "Which folder has your code?"
- Pick: **itam-saas/Agent**
- Click **Deploy** or **Continue**

## STEP 4: Add Settings (Environment Variables)

Go to the **Variables** tab in Railway.

**Add Variable #1:**
- Click **+ Add Variable**
- Key: `DATABASE_URL`
- Value: `postgresql://postgres:Le%24hem%40023@db.mqizpxxcuhpldpthacxk.supabase.co:5432/postgres`
- Click **Add**

**Add Variable #2:**
- Click **+ Add Variable**
- Key: `NODE_ENV`
- Value: `production`
- Click **Add**

**Add Variable #3:**
- Click **+ Add Variable**
- Key: `PORT`
- Value: `5000`
- Click **Add**

## STEP 5: Wait for Green Checkmark
- Go to **Deployments** tab
- Wait until you see a **green checkmark ✓**
- This means it's working! (takes 2-5 minutes)

## STEP 6: Get Your Public URL
- Click on the **Settings** tab
- Look for **Domains** section
- You'll see something like: `https://it-asset-project-xxxxx.railway.app`
- **Copy this URL**

## STEP 7: Tell Me the URL
- Come back and tell me the Railway URL
- I'll update Vercel for you
- Then test everything works!

---

## QUICK CHECKLIST:
- [ ] Logged into Railway with GitHub
- [ ] Selected IT-ASSET-PROJECT
- [ ] Selected itam-saas/Agent folder
- [ ] Added DATABASE_URL variable
- [ ] Added NODE_ENV variable
- [ ] Added PORT variable
- [ ] Waited for green checkmark
- [ ] Copied Railway URL
- [ ] Ready to tell me the URL!

