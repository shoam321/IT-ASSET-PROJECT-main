# Billing `/api/billing` 400 Fix (Org context)

## Problem
The Billing page calls `GET /api/billing`.

In production, some users were receiving:
- `GET https://it-asset-project-production.up.railway.app/api/billing 400 (Bad Request)`

Root cause:
- The billing endpoints required an `organizationId` claim on the JWT (`req.user.organizationId`).
- Some auth flows (notably Google SSO `findOrCreateGoogleUser`) can create users without an `organization_id` assignment in the database.
- Additionally, older or post-bootstrap tokens may not include `organizationId` even if the DB user now has `organization_id`.

This combination caused `/api/billing` to return `400` for otherwise-valid logged-in users.

## Fix (Backend)
File: `itam-saas/Agent/server.js`

### `GET /api/billing`
- Still requires authentication (`authenticateToken`).
- Determines org context in this order:
  1. `req.user.organizationId` from JWT (preferred)
  2. fallback to DB lookup `authQueries.findUserById(userId)` and use `organization_id`
- If **no organization** exists after fallback:
  - returns `200` with:
    ```json
    { "billing": null, "needsOrganization": true }
    ```
  - This is treated as a normal application state (user must bootstrap/join an organization), not a client-breaking error.

### `POST /api/billing/paypal/subscription/approve`
- Uses the same organizationId fallback strategy.
- If no organization is found, returns:
  - `409` with `error: "You must create or join an organization before subscribing."`

Security / tenancy notes:
- Authentication remains required.
- DB Row-Level Security context is still set by `authenticateToken()`.
- Organization role checks (owner/admin) remain enforced for subscription management.

## Fix (Frontend)
File: `itam-saas/Client/src/components/Billing.jsx`

- Added `needsOrganization` state.
- When `GET /billing` returns `{ needsOrganization: true }`:
  - shows a clear message indicating organization setup is required
  - prevents rendering PayPal subscribe UI until org exists
- Also includes backwards-compatible handling if the server still responds with the old 400 message.

## Expected Live Behavior
- Billing page no longer logs `400 (Bad Request)` for users missing org assignment.
- Users without an organization see a guidance message.
- Once the user creates/joins an organization, Billing loads and subscription UI becomes available.

## Deployment Notes
- Deploy the updated Agent service (Railway) so `/api/billing` behavior changes are live.
- Deploy the updated Client (Vercel) to reflect the improved UI state handling.
