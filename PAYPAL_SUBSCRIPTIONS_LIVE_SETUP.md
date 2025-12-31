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

### Backend (Railway)
Set:
- `PAYPAL_MODE=live`
- `PAYPAL_CLIENT_ID` = your PayPal **Client ID**
- `PAYPAL_CLIENT_SECRET` = your PayPal **Client Secret**
- `PAYPAL_WEBHOOK_ID` = your PayPal **Webhook ID**
- `PAYPAL_REGULAR_PLAN_ID` = your PayPal **Plan ID** (e.g. `P-...`) (recommended for validation)

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
