# PayPal Payments (Orders) + Billing Upgrade

This project supports **instant PayPal payments** (PayPal Orders API) from the **Billing** page.

After a successful capture, the backend upgrades the user’s **organization billing tier** (Pro/Enterprise) only when the captured amount and currency match server-enforced pricing.

> Note: There is also a separate PayPal **subscription** webhook flow documented in `PAYPAL_SUBSCRIPTIONS_LIVE_SETUP.md`.

---

## What Users See

In the app, users go to **Billing**, pick a plan, click **Pay Now with PayPal**, approve, and the UI calls capture.

Implementation:
- Frontend UI: `itam-saas/Client/src/components/Billing.jsx`
- Screen routing: `itam-saas/Client/src/App.jsx` (screen `billing`)

The old admin-only “Reset to Free Trial” testing button has been removed.

---

## Backend Architecture

Files:
- PayPal client wrapper: `itam-saas/Agent/paypalClient.js`
- PayPal endpoints + billing upgrade: `itam-saas/Agent/server.js`
- Persistence + migrations bootstrap: `itam-saas/Agent/queries.js`
- Migration SQL: `itam-saas/Agent/migrations/add-payments.sql`

Key design choices:
- **Server-side pricing enforcement**: client cannot choose price.
- **Ownership validation**: order is tagged with PayPal `custom_id` and verified at capture time.
- **Non-blocking persistence**: payment still works even if `payments` table is missing/drifted.
- **Auto-patching migrations on startup** for payments tables/columns.

---

## Environment Variables

### Frontend (Vercel / CRA build)
- `REACT_APP_API_URL`
  - Example: `https://<your-railway-host>/api`
- `REACT_APP_PAYPAL_CLIENT_ID`
  - Required for `@paypal/react-paypal-js`.

Notes:
- CRA `REACT_APP_*` are **build-time**; redeploy after changing.

### Backend (Railway)
Required:
- `PAYPAL_MODE` = `live` or `sandbox`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID` (required if using the webhook endpoint)

Pricing (enforced server-side):
- `PAYPAL_PRO_PRICE_CENTS` (default `2900`)
- `PAYPAL_ENTERPRISE_PRICE_CENTS` (default `9900`)

Recommended:
- `FRONTEND_URL` and/or `REACT_APP_URL` for CORS allowlist and return/cancel URLs.

---

## API Endpoints

### Create an order
`POST /api/payments/paypal/order`

Auth: required (JWT)

Body (client can send these, but server enforces price):
```json
{
  "plan": "regular" | "enterprise",
  "currency": "USD",
  "description": "..."
}
```

Behavior:
- Computes amount from `PAYPAL_*_PRICE_CENTS`.
- Currently **USD-only** (rejects other currencies).
- Sets PayPal `custom_id` to `org:<orgId>;user:<userId>` when possible.
- Attempts to insert into `payments` (non-blocking if DB schema is missing).

Response:
```json
{ "orderId": "...", "approveUrl": "...", "status": "CREATED" }
```

### Capture an order
`POST /api/payments/paypal/capture`

Auth: required (JWT)

Body:
```json
{ "orderId": "...", "plan": "regular" | "enterprise" }
```

Behavior:
- Calls PayPal `OrdersGet` to verify `custom_id` matches the current user/org.
  - If PayPal verification fails, non-admin receives `503` and should retry.
- Captures via PayPal `OrdersCapture`.
- Attempts to persist capture into `payments` (non-blocking on schema issues).
- Upgrades the organization only if:
  - capture `status === "COMPLETED"`
  - captured currency is `USD`
  - captured amount equals expected plan price (in cents)
- Sets `subscription_status = active` and `subscription_current_period_end = now + 30 days`.

Response:
```json
{ "status": "COMPLETED", "captureId": "...", "upgraded": true }
```

### Webhook (Orders events)
`POST /api/payments/paypal/webhook`

Purpose:
- Verifies PayPal signature.
- Writes an audit record into `webhook_events`.
- Upserts into `payments` when possible.

### Webhook (Subscription events)
`POST /api/billing/paypal/webhook`

See `PAYPAL_SUBSCRIPTIONS_LIVE_SETUP.md`.

---

## Database Persistence & Migrations

Tables created/patched by `itam-saas/Agent/migrations/add-payments.sql`:
- `payments`
  - Important columns: `order_id` (unique), `capture_id`, `user_id`, `amount_cents`, `currency`, `status`, `metadata`, timestamps.
- `webhook_events`
  - `event_id` unique, `event_type`, `payload`, `status`, `processed_at`.

Schema drift handling:
- On backend startup, `initDatabase()` checks for `payments` and specifically `payments.order_id`.
- If missing, it automatically applies `add-payments.sql`.

Manual migration runner:
- `node itam-saas/Agent/migrations/run-payments-migration.js`
  - Uses `DATABASE_OWNER_URL` first (recommended if permissions are limited), otherwise `DATABASE_URL`.

---

## Security Notes (Important)

- **Do not trust client price**: the server ignores client price and computes price from env.
- **No upgrade on underpayment**: upgrade only happens when amount/currency match expected.
- **Order ownership validation**: verified against PayPal `custom_id` during capture.
- **Persistence is best-effort**: DB failures won’t block capturing/upgrading, but will reduce audit/history until migrations are fixed.

---

## Verification Checklist

1. Billing page loads and shows PayPal buttons.
2. `POST /api/payments/paypal/order` returns `200` with `orderId`.
3. `POST /api/payments/paypal/capture` returns `COMPLETED` and `upgraded: true`.
4. `GET /api/billing` shows `billing_tier` updated and `subscription_status: active`.
5. (Optional) `GET /api/payments` returns history; if it returns empty with a warning, run/confirm payments migration.

---

## Troubleshooting

### `invalid_client` / auth errors
- Check `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` in Railway.
- Confirm `PAYPAL_MODE` matches the credential type (live vs sandbox).

### 500s mentioning `order_id` missing
- Payments table schema drift.
- Confirm startup auto-migration ran, or run:
  - `node itam-saas/Agent/migrations/run-payments-migration.js`

### Capture returns `503 Unable to verify`
- PayPal `OrdersGet` failed temporarily.
- Retry capture (non-admin is fail-closed by design).

### PayPal button not showing
- Frontend missing `REACT_APP_PAYPAL_CLIENT_ID` at build time.
- Redeploy Vercel after setting env var.
