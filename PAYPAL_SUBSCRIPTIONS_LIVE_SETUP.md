# PayPal Subscriptions (Live) – Minimal Setup

This project supports **company-level** monthly subscriptions:
- **Regular** = PayPal monthly subscription
- **Enterprise** = manual activation (admin)

## 1) PayPal Dashboard
1. Create a **Product** (once).
2. Create a **Plan** under that product:
   - Billing cycle: **Monthly**
   - Pricing: your choice
   - Status: **Active**
3. Copy the **Plan ID** (looks like `P-...`).

## 2) Live Environment Variables

### Frontend (Vercel)
Set:
- `REACT_APP_PAYPAL_CLIENT_ID` = your PayPal **Client ID**
- `REACT_APP_PAYPAL_REGULAR_PLAN_ID` = your PayPal **Plan ID** (e.g. `P-...`)

Notes:
- For Create React App, `REACT_APP_*` variables are **build-time**. After changing them in Vercel, trigger a **new deployment**.
- Ensure you set variables for the correct Vercel environments (at minimum **Production**, and usually **Preview**).
- If the Billing page shows `Missing REACT_APP_PAYPAL_REGULAR_PLAN_ID`, Vercel does not currently have that variable set for the deployed build.

### Backend (Railway)
Set:
- `PAYPAL_MODE=live`
- `PAYPAL_CLIENT_ID` = your PayPal **Client ID**
- `PAYPAL_CLIENT_SECRET` = your PayPal **Client Secret**
- `PAYPAL_WEBHOOK_ID` = your PayPal **Webhook ID**
- `PAYPAL_REGULAR_PLAN_ID` = your PayPal **Plan ID** (e.g. `P-...`) (recommended for validation)

Optional (debug only):
- `DEBUG_RLS=true` to enable verbose `app.current_user_id` logs. Leave unset/false in production to reduce log noise.

## 3) Database Migration
Run the org billing migration on the production DB:
- Script: `npm run migrate:org-billing` (in the Agent service)

## 4) Webhook
Create a PayPal webhook for your Live app:
- URL: `https://<YOUR_RAILWAY_HOST>/api/billing/paypal/webhook`

Enable (minimum useful set):
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.EXPIRED`

Then copy the generated **Webhook ID** into `PAYPAL_WEBHOOK_ID`.

## 5) Live Verification
- Go to the app → **Billing**
- Click **Subscribe** under Regular
- Approve in PayPal
- Billing page should show company `subscription_status` becoming **active**
