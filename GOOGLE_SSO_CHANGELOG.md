# Google SSO Integration - Change Log

## Summary
This update adds Google Single Sign-On (OAuth 2.0) to the IT Asset Management project, allowing users to log in with their Google accounts in addition to the existing username/password system.

## Key Changes

### Backend
- **Dependencies:** Added `passport`, `passport-google-oauth20`, and `express-session` to `package.json`.
- **Database Migration:**
  - Added `add-google-sso.sql` and `run-google-sso-migration.js` to add `google_id`, `profile_picture`, and `auth_provider` columns to the `users` table.
- **OAuth Logic:**
  - Configured Passport.js with GoogleStrategy in `server.js`.
  - Added `/api/auth/google` and `/api/auth/google/callback` endpoints for OAuth flow.
  - Added user matching/creation logic in `queries.js` (`findOrCreateGoogleUser`).
  - Issues JWT token after successful Google login.
  - Logs SSO logins in audit trail.
- **Session Management:**
  - Configured `express-session` for Passport.js.
- **Environment Variables:**
  - Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `FRONTEND_URL`, `SESSION_SECRET`.

### Frontend
- **Login UI:**
  - Added "Sign in with Google" button to `Login.jsx`.
  - Handles OAuth callback in `AuthWrapper.jsx` (extracts token, logs in user, handles errors).

## How It Works
1. User clicks "Sign in with Google".
2. Redirects to Google OAuth consent screen.
3. On success, backend finds/creates user, issues JWT, and redirects to frontend with token.
4. Frontend stores token and logs in user.

## Migration
- Migration runs automatically on backend start (via start script).

## Security
- Hybrid auth: Both Google SSO and password login are supported.
- JWT tokens, session cookies, and audit logging for all logins.

---

**Commit:** f785744
**Date:** 2025-12-27
**By:** GitHub Copilot
