# Google OAuth Consent Screen Polish

## Steps to Update Privacy Policy & Terms URLs

### 1. Go to Google Cloud Console
https://console.cloud.google.com/apis/credentials/consent

### 2. Select Your OAuth Project
- Project: (your IT Asset Manager project)

### 3. Edit OAuth Consent Screen

**App Information Section:**
- Privacy policy link: `https://it-asset-project-production.up.railway.app/api/legal/privacy-policy`
- Terms of service link: `https://it-asset-project-production.up.railway.app/api/legal/terms-of-service`

### 4. Authorized Domains (if not already set)
Add:
- `railway.app`
- `vercel.app`

### 5. Save Changes

---

## Verification

After saving, test Google OAuth login:
1. Go to https://it-asset-project.vercel.app
2. Click "Sign in with Google"
3. Verify consent screen shows Privacy Policy & Terms links
4. Complete login flow

✅ **Done!** Users will now see proper legal links during Google sign-in.
