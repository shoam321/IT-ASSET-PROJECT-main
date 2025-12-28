# Debuggability Guide (IT Asset SaaS)

This repo has 4 moving parts:

1) **Client (React)**: `itam-saas/Client/` — calls the backend under `/api/*`
2) **Backend (Node/Express)**: `itam-saas/Agent/` — REST API + audit logs + alerts + uploads
3) **Database (PostgreSQL)** — multi-tenancy via RLS + audit trail via `audit_logs`
4) **Tauri Agent**: `itam-saas/TauriAgent/` — device monitoring + sends usage/alerts to backend

This guide is optimized for “find the root cause fast”.

---

## 0) Quick triage checklist (fast)

### Backend won’t start (exit code 1)
- Check env vars:
  - `JWT_SECRET` **must** be set (the auth middleware exits if missing)
  - `DATABASE_URL` must be valid
- Run:
  - `node --check itam-saas/Agent/server.js`
  - Start backend and watch the startup diagnostics printed at boot.

### UI shows 404 for an endpoint
- Confirm the UI base URL includes `/api`.
  - Backend routes are mounted under `/api/*`.

### UI shows 401/403
- Token expired / missing:
  - Client must send `Authorization: Bearer <token>`
- Role mismatch:
  - Admin-only routes require `role === 'admin'` in the JWT.

---

## 1) Request correlation (super important)

The backend adds a request id to every response:

- Response header: `x-request-id: <uuid>`
- Server log line format:
  - `[timestamp] [requestId] METHOD /api/... -> status (durationMs)`

When a client reports an error, grab `x-request-id` and search the backend logs for it.

---

## 2) Core flows (what calls what)

### A) Login → JWT → RBAC
1. Client calls `POST /api/auth/login`
2. Backend verifies password (`bcryptjs`) and returns JWT (`jsonwebtoken`)
3. Client stores token (localStorage) and sends it on future requests
4. Backend middleware verifies token and normalizes payload

Key code:
- JWT verification: `itam-saas/Agent/middleware/auth.js`
- Login handler: `itam-saas/Agent/server.js`

### B) Multi-tenancy (RLS)
1. Every authenticated request has `req.user.userId`
2. Backend calls `setCurrentUserId(userId)` before DB queries
3. Postgres RLS policies filter rows based on `app.current_user_id`

Key code:
- `setCurrentUserId()`: `itam-saas/Agent/queries.js`

### C) Forbidden Apps CRUD → Audit Trail
1. Admin UI calls:
   - `GET /api/forbidden-apps`
   - `POST /api/forbidden-apps`
   - `PUT /api/forbidden-apps/:id`
   - `DELETE /api/forbidden-apps/:id`
2. Backend writes changes to `forbidden_apps`
3. Backend logs compliance events to `audit_logs` via `logAuditEvent()`

Key code:
- Routes: `itam-saas/Agent/server.js`
- Queries + audit helper: `itam-saas/Agent/queries.js`

Audit model:
- Actions are constrained to: `LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `DELETE`

### D) Agent alert → Security alerts table → UI
1. Tauri Agent calls `POST /api/alerts`
2. Backend inserts into `security_alerts`
3. WebSocket / polling surfaces it in UI

Key code:
- Alerts routes: `itam-saas/Agent/server.js`
- DB layer: `itam-saas/Agent/queries.js`

---

## 3) Environment variables (backend)

Required:
- `DATABASE_URL`
- `JWT_SECRET`

Recommended:
- `SESSION_SECRET` (Passport)
- `REACT_APP_URL` (comma-separated allow-list for CORS)

Bootstrap-only (dev):
- `AUTO_CREATE_ADMIN=true` (creates an admin **only if no admin exists**)
- `ADMIN_INITIAL_PASSWORD` (optional; otherwise generated and printed once)

See also: `itam-saas/Agent/README.md`

---

## 4) Common failure modes → where to look

### “Forbidden apps not loading”
- Check the UI is calling `/api/forbidden-apps` (not `/forbidden-apps`).
- Check backend logs for request id and status.
- If 403: the user is not admin.

### “Audit trail missing forbidden apps actions”
- Confirm backend routes call `logAuditEvent('forbidden_apps', ...)`.
- Confirm `audit_logs` table exists in Postgres and accepts actions.

### “Everything works locally but not on Railway/Vercel”
- Compare env vars (especially `JWT_SECRET`, `DATABASE_URL`, `REACT_APP_URL`).
- CORS errors: backend prints allowed origins at startup.

---

## 5) Useful commands

### Backend syntax check
- `node --check itam-saas/Agent/server.js`

### Smoke test (PowerShell)
Replace base URL as needed.

- Login, create forbidden app, delete it, fetch audit logs:
  - (Use the same pattern you’ve already been using, then grep logs by `x-request-id`)

---

If you want, I can also add a short “Runbook: production incident” section (what logs/queries to capture, and a minimal SQL snippet set to inspect `audit_logs`, `forbidden_apps`, and `security_alerts`).
