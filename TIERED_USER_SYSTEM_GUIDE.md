# Tiered User System - Implementation Guide

## Overview

Your IT Asset Management system now has a **tiered user permission system** where:

- **Regular Users** can only see their own devices, device usage, and assigned assets
- **Admins** can see and manage everything across all users
- **Agent and Web Frontend are synchronized** - User X sees only their data on both platforms

## Key Features

### 1. Row-Level Security (RLS)
PostgreSQL RLS policies automatically filter data based on user role:

| Table | User Access | Admin Access |
|-------|-------------|--------------|
| `devices` | Own devices only | All devices |
| `device_usage` | Own usage only | All usage data |
| `assets` | Own assets + unassigned | All assets |
| `licenses` | Own licenses + unassigned | All licenses |
| `contracts` | No access | Full access |
| `users` | Own record only | All users |
| `security_alerts` | Own alerts only | All alerts |
| `forbidden_apps` | Read-only list | Full CRUD |

### 2. User Authentication Flow

#### Web Frontend Login:
1. User logs in at `/api/auth/login` with username/password
2. Backend validates credentials
3. JWT token issued with `userId` and `role`
4. Frontend stores token and uses for all API calls

#### Desktop Agent Login:
1. User logs in to Tauri agent with same credentials
2. Agent calls `/api/auth/login` and receives same JWT token
3. Token stored locally and used for all device data submission
4. Device data automatically linked to logged-in user

### 3. Data Synchronization

When User X logs in:

**Web Frontend:**
- GET `/api/agent/devices` → Returns only User X's devices
- GET `/api/assets` → Returns only User X's assets
- GET `/api/agent/apps/usage` → Returns only User X's app usage

**Desktop Agent:**
- POST `/api/agent/usage` with JWT → Device data tagged with User X's ID
- POST `/api/agent/heartbeat` with JWT → Heartbeat linked to User X
- GET `/api/forbidden-apps` → Forbidden app list (same for all users)

**Result:** User X sees identical data on both web and agent - only their own devices and usage.

## Implementation Details

### Database Schema Changes

Run the migration to add user ownership:

\`\`\`bash
node itam-saas/Agent/migrations/run-user-asset-ownership-migration.js
\`\`\`

This migration adds:
- `user_id` column to `assets`, `licenses`, `contracts` tables
- Row-Level Security policies on all tables
- Indexes for performance

### API Endpoints

All endpoints use `authenticateToken` middleware which:
1. Validates JWT token
2. Extracts `userId` and `role`
3. Calls `setCurrentUserId(userId)` to set PostgreSQL session variable
4. RLS policies automatically filter queries

### Agent Data Flow

\`\`\`mermaid
sequenceDiagram
    User->>Agent: Login (username, password)
    Agent->>API: POST /api/auth/login
    API->>Agent: JWT token (userId, role)
    Agent->>API: POST /api/agent/usage (with JWT)
    API->>DB: Extract userId from JWT
    API->>DB: INSERT device_usage (device_id, user_id, app_name...)
    DB->>DB: RLS enforces user_id = current_user
\`\`\`

## User Roles

### Regular User (`role: 'user'`)
**Capabilities:**
- View own devices and usage data
- View own assets and licenses
- View own security alerts
- Cannot create/edit/delete assets (admin-only)
- Cannot access contracts
- Cannot see other users' data

**Example User:**
\`\`\`sql
INSERT INTO auth_users (username, email, password_hash, role)
VALUES ('john.doe', 'john@example.com', '$2b$10$...', 'user');
\`\`\`

### Admin User (`role: 'admin'`)
**Capabilities:**
- View ALL devices, usage, and alerts from ALL users
- Full CRUD on assets, licenses, contracts
- Create/manage user accounts
- Assign assets to users
- View audit logs

**Creating First Admin:**
\`\`\`bash
node itam-saas/Agent/create-admin.js
\`\`\`

## Testing the Tiered System

### Test Scenario 1: User Isolation

1. **Create two regular users:**
   \`\`\`sql
   INSERT INTO auth_users (username, email, password_hash, role)
   VALUES 
     ('alice', 'alice@company.com', '$2b$10$hash1', 'user'),
     ('bob', 'bob@company.com', '$2b$10$hash2', 'user');
   \`\`\`

2. **Alice logs into Agent:**
   - Agent collects device data
   - Device tagged with Alice's user_id

3. **Alice logs into Web:**
   - Sees only her device(s)
   - Cannot see Bob's devices

4. **Bob logs into Agent:**
   - Agent collects device data
   - Device tagged with Bob's user_id

5. **Bob logs into Web:**
   - Sees only his device(s)
   - Cannot see Alice's devices

### Test Scenario 2: Admin Oversight

1. **Admin logs into Web:**
   - Sees ALL devices (Alice's + Bob's)
   - Can filter by user
   - Can create assets and assign to specific users

2. **Admin creates asset for Alice:**
   \`\`\`javascript
   POST /api/assets
   {
     "asset_tag": "LAPTOP-001",
     "asset_type": "Laptop",
     "user_id": <alice_user_id>,
     ...
   }
   \`\`\`

3. **Alice views assets:**
   - Sees LAPTOP-001 (assigned to her)
   - Doesn't see assets assigned to others

### Test Scenario 3: Agent-Web Synchronization

1. **User logs into Agent** (username: alice)
2. **Agent sends usage data** → Tagged with Alice's user_id
3. **User logs into Web** (username: alice)
4. **Web displays device list** → Shows only Alice's device
5. **Verify:** Device hostname matches PC where agent is running
6. **Verify:** Usage data shows apps from Alice's PC only

## Security Benefits

### Defense in Depth
- **Application Layer:** JWT authentication validates user identity
- **Database Layer:** RLS enforces data isolation automatically
- **Zero Trust:** Even if app code has bugs, database prevents data leaks

### Protection Against:
- **SQL Injection:** Parameterized queries + RLS double protection
- **Broken Access Control:** Database enforces rules, not just app code
- **Privilege Escalation:** Role-based policies prevent unauthorized access
- **Data Leakage:** Users cannot access other users' data even with direct DB access

## Troubleshooting

### User sees no devices
**Cause:** User_id mismatch or RLS not set
**Fix:**
\`\`\`javascript
// Check if setCurrentUserId is called before queries
await db.setCurrentUserId(req.user.userId);
\`\`\`

### Admin sees no data
**Cause:** Admin role not set in database
**Fix:**
\`\`\`sql
UPDATE auth_users SET role = 'admin' WHERE username = 'admin';
\`\`\`

### Agent data not appearing in web
**Cause:** Different user logged in on agent vs web
**Fix:** Ensure same username/password on both platforms

### "Permission denied" errors
**Cause:** RLS policy blocking operation
**Fix:** Check user role and table policies in migration file

## API Reference

### Authentication
- **POST** `/api/auth/login` - Login and get JWT token
- **POST** `/api/auth/register` - Register new user (admin-only)

### Devices (User-filtered)
- **GET** `/api/agent/devices` - Get devices (filtered by RLS)
- **GET** `/api/agent/devices/:deviceId/usage` - Get device usage (filtered by RLS)
- **GET** `/api/agent/apps/usage` - Get app usage summary (filtered by RLS)

### Assets (User-filtered)
- **GET** `/api/assets` - Get assets (users see own, admins see all)
- **GET** `/api/assets/:id` - Get asset by ID (RLS enforced)
- **POST** `/api/assets` - Create asset (admin-only, can assign to users)
- **PUT** `/api/assets/:id` - Update asset (admin-only)

### Security Alerts (User-filtered)
- **GET** `/api/alerts` - Get alerts (filtered by RLS)
- **POST** `/api/alerts` - Create alert (agent, auto-tagged with user_id)

## Next Steps

1. **Run Migration:** `node itam-saas/Agent/migrations/run-user-asset-ownership-migration.js`
2. **Create Admin:** `node itam-saas/Agent/create-admin.js`
3. **Test Agent Login:** Login with user credentials, verify device data appears
4. **Test Web Login:** Login with same credentials, verify same device appears
5. **Test Isolation:** Create second user, verify they can't see first user's data
6. **Monitor Logs:** Check PostgreSQL session variables and RLS policy enforcement

## Summary

✅ **Tiered User System Active**
- Users see only their own devices and assets
- Admins see everything
- Agent and web are synchronized via JWT user context
- Database-level security (RLS) provides defense in depth
- Zero-trust architecture prevents data leakage
