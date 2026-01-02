## Release Checklist (Live Only)

- Backend redeploy (Railway)
  - Redeploy backend service from latest commit; confirm build passes.
  - Verify env vars on Railway match [RAILWAY_ENV_CONFIG.md](RAILWAY_ENV_CONFIG.md): `DATABASE_URL`, `USE_PG_SESSION`, `SESSION_SECRET`, `DB_*`, `GRAFANA_URL`, `JWT_SECRET`, `NODE_ENV=production`, `PORT=3000`.
- Frontend config (Vercel)
  - Ensure `REACT_APP_API_URL` points to `https://it-asset-project-production.up.railway.app/api`.
- Post-deploy validation (live)
  - From https://it-asset-project.vercel.app, sign in (Google and email/password) and confirm `/api/auth/me` returns 200 with user payload.
  - Complete onboarding once; confirm Setup Wizard does not reappear on refresh.
  - Create a test asset and organization; verify persistence in dashboard tables.
- Agent distribution
  - Distribute [itam-saas/TauriAgent/IT-Asset-Agent-Deployment.zip](itam-saas/TauriAgent/IT-Asset-Agent-Deployment.zip).
  - Recipient flow: extract, run `tauriagent.exe`, log in, ensure device appears on dashboard within 2 minutes.
- Smoke checks
  - Health endpoint: `https://it-asset-project-production.up.railway.app/health` returns OK.
  - Billing/org guard: authenticated user reaches app without 404; org-required users are routed through onboarding.
  - Grafana link (if used) resolves to [REACT_APP_GRAFANA_URL](RAILWAY_ENV_CONFIG.md#L17) target.

### Live verification log
- 2026-01-02T21:08:28Z: health/vars status OK; db URL set; version 6e9d29df12942ddc21a688835ae5b07c2dbbe8a3 (from user report)
