# Backend Server (Agent API) Setup

This service is the Node.js/Express backend for the ITAM SaaS. It provides:
- REST APIs under `/api/*` (assets, licenses, contracts, users, forbidden apps, audit logs, receipts)
- JWT authentication and RBAC (`admin` vs `user`)
- PostgreSQL Row-Level Security (multi-tenancy) via `setCurrentUserId()`
- Audit logging to `audit_logs` for compliance (CREATE/UPDATE/DELETE, LOGIN/LOGOUT)
- WebSocket (Socket.IO) for realtime alerts
- Optional Google SSO via Passport

## Dependencies

- Node.js (ESM project; Node 18+ recommended)
- PostgreSQL (Railway/Supabase/your own)

Key npm dependencies (see `package.json`):
- `express`, `cors`, `body-parser`: API server
- `pg`: Postgres driver
- `jsonwebtoken`: JWT auth
- `bcryptjs`: password hashing
- `express-rate-limit`: auth endpoint throttling
- `socket.io`: realtime alerts
- `passport`, `passport-google-oauth20`: Google SSO
- `multer`: receipt uploads

## Environment Variables

Create a `.env` file in this folder (`itam-saas/Agent/.env`). Never commit it.

Minimum required:
```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
JWT_SECRET=change-me-to-a-long-random-string
PORT=5000
NODE_ENV=development
```

Recommended:
```
# Used by express-session (Passport). If omitted, falls back to JWT_SECRET.
SESSION_SECRET=change-me-too

# CORS allow-list (comma-separated). Examples:
# REACT_APP_URL=http://localhost:3000,https://your-frontend.vercel.app
REACT_APP_URL=http://localhost:3000

# Google SSO (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

# Bootstrap-only (DEV ONLY). Do not leave enabled in production.
AUTO_CREATE_ADMIN=false
# If AUTO_CREATE_ADMIN=true and no admin exists, this password will be used.
# If omitted, a strong password is generated and printed once to the console.
ADMIN_INITIAL_PASSWORD=
```

## Database Migrations

This project runs migrations during `npm start` (see `scripts.start` in `package.json`).
If you need to run a specific migration manually, check `itam-saas/Agent/migrations/`.

## Install + Run

```bash
npm install
npm start
```
