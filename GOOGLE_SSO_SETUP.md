# Google SSO Setup Instructions

## ✅ Implementation Complete!

Google Single Sign-On (OAuth 2.0) has been integrated into your IT Asset Management app.

## 🔧 Configuration Required

Add these environment variables to **Railway**:


```env
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_CALLBACK_URL=https://it-asset-project-production.up.railway.app/api/auth/google/callback
FRONTEND_URL=https://it-asset-project.vercel.app
SESSION_SECRET=your-random-secret-here
```

**Do NOT commit your actual Google OAuth credentials to source control.**

Add your real credentials directly to the Railway environment variables dashboard. Never store secrets in this file or in the repository.

### How to Add in Railway:
1. Go to https://railway.app/project/your-project
2. Click on your service
3. Click "Variables" tab
4. Click "New Variable"
5. Add each variable above
6. Click "Deploy"

## 🎯 Features Implemented

### Backend:
✅ Passport.js OAuth 2.0 integration
✅ Google Strategy configuration
✅ Database migration (`google_id`, `profile_picture`, `auth_provider` columns)
✅ User matching by email (links existing accounts)
✅ Auto-create new users from Google profile
✅ JWT token generation after successful OAuth
✅ Audit logging for SSO logins
✅ Session management with express-session

### Frontend:
✅ "Sign in with Google" button with Google branding
✅ OAuth redirect handling
✅ Token extraction from callback URL
✅ Auto-login after OAuth success
✅ Error handling for failed authentication

## 🔐 How It Works

1. User clicks "Sign in with Google"
2. Redirects to Google OAuth consent screen
3. User approves (email + profile access)
4. Google redirects to `/api/auth/google/callback`
5. Backend finds or creates user account
6. Generates JWT token
7. Redirects to frontend with token
8. Frontend stores token and logs in user

## 📊 User Matching Logic

- **Existing user with Google email?** → Links Google account to existing user
- **New Google email?** → Creates new user account with:
  - Username: Display name from Google
  - Email: Google email
  - Role: `User` (default)
  - Status: `Active`
  - Profile picture: Google avatar

## 🧪 Testing

1. Deploy Railway with environment variables
2. Go to https://it-asset-project.vercel.app
3. Click "Sign in with Google"
4. Approve permissions
5. You should be logged in!

## ⚠️ Important Notes

- Existing password login **still works** (hybrid auth)
- Google domain restriction: **Not enabled** (any @gmail.com works)
- OAuth only for **regular users** (not super admins)
- Test users in Google Console: Need to add to test users list

## 🔒 Security

- ✅ Session cookies (HTTP-only in production)
- ✅ JWT tokens (7-day expiry)
- ✅ State parameter for CSRF protection
- ✅ Audit logging for all SSO logins
- ✅ Rate limiting on auth endpoints

## 📝 Next Steps (Optional)

1. **Domain restriction**: Limit to specific domains (e.g., `@yourcompany.com`)
2. **Role mapping**: Assign roles based on Google Workspace groups
3. **Force SSO**: Disable password login for specific users
4. **MFA**: Enable 2FA requirement for Google accounts
