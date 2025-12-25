# 🔒 Multi-Tenancy & Security Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Who is the Admin?](#who-is-the-admin)
3. [How It Works](#how-it-works)
4. [Creating the First Admin](#creating-the-first-admin)
5. [Security Architecture](#security-architecture)
6. [Technical Implementation](#technical-implementation)
7. [Lessons Learned & Fixes](#lessons-learned--fixes)
8. [Testing Multi-Tenancy](#testing-multi-tenancy)

---

## Overview

This IT Asset Management system now implements **secure multi-tenancy** with **Row-Level Security (RLS)**. This means:

- **Admin users** can see ALL devices and usage data from ALL users
- **Regular users** can ONLY see their OWN devices and usage data
- Security is enforced at BOTH the application layer AND the database layer (defense-in-depth)

---

## Who is the Admin?

### Creating the First Admin

The admin is the superuser who can see everything. You must create the first admin manually:

```bash
# Navigate to Agent directory
cd itam-saas/Agent

# Create admin with default credentials
node create-admin.js

# Or create admin with custom credentials
node create-admin.js myusername admin@company.com SecurePass123 "Jane Doe"
```

### Default Admin Credentials

If you use `node create-admin.js` without arguments:
- **Username:** `admin`
- **Email:** `admin@itasset.local`
- **Password:** `admin123`
- **Role:** `admin`

⚠️ **IMPORTANT:** Change the password after first login in production!

### Where Admin Data is Stored

- Admin account is stored in the `auth_users` table in PostgreSQL
- The `role` column determines if user is `'admin'` or `'user'`
- During migration, all existing devices are assigned to the first admin user

---

## How It Works

### 1. User Login Flow

```
User enters credentials
    ↓
Backend verifies username/password
    ↓
Backend checks user's role from auth_users table
    ↓
Backend generates JWT token with:
  - userId
  - username
  - email
  - role ('admin' or 'user')
  - permissions array
    ↓
Frontend stores token in localStorage
    ↓
Frontend sends token with every API request
```

### 2. API Request Flow

```
Client sends request with JWT token
    ↓
authenticateToken() middleware verifies token signature
    ↓
JWT decoded → { userId, role, permissions }
    ↓
authorize() middleware checks permissions
    ↓
setCurrentUserId(userId) sets PostgreSQL session variable
    ↓
Database query executes with RLS filtering
    ↓
Response sent to client
```

### 3. Database Filtering (Row-Level Security)

**For Admin Users:**
```sql
-- RLS Policy checks:
SELECT * FROM devices WHERE user_id = <current_user_id>
OR EXISTS (SELECT 1 FROM auth_users WHERE id = <current_user_id> AND role = 'admin')

-- Result: Admin sees ALL devices because role='admin'
```

**For Regular Users:**
```sql
-- RLS Policy checks:
SELECT * FROM devices WHERE user_id = <current_user_id>

-- Result: User ONLY sees devices where user_id matches their ID
```

---

## Security Architecture

### Three Layers of Security (Defense-in-Depth)

#### Layer 1: JWT Authentication
- Every API request must include valid JWT token
- Token cryptographically signed with JWT_SECRET
- Can't be tampered with (signature verification fails)
- Expires after 7 days

#### Layer 2: Permission-Based Authorization
- `authorize()` middleware checks permissions array
- Example: `authorize('read:all_devices')` → Only admins pass
- Happens at application layer (fast)

#### Layer 3: Row-Level Security (PostgreSQL)
- Database enforces access rules at data layer
- Even if app code has bugs, database blocks unauthorized queries
- Uses session variable: `app.current_user_id`
- Zero-trust model: Every query is filtered

### Permissions by Role

**Admin Permissions:**
- `'read:all_devices'` - View all devices from all users
- `'write:all_devices'` - Create/update any device
- `'manage:users'` - Create/edit/delete users (future feature)
- `'read:own_devices'` - View own devices
- `'write:own_devices'` - Create/update own devices

**User Permissions:**
- `'read:own_devices'` - View only own devices
- `'write:own_devices'` - Create/update only own devices

---

## Technical Implementation

### Files Modified

#### 1. Database Migration
**File:** `itam-saas/Agent/migrations/add-multi-tenancy.sql`
- Added `user_id` column to `devices` and `device_usage` tables
- Enabled Row-Level Security on both tables
- Created 6 security policies (SELECT, INSERT, UPDATE for each table)
- Assigned existing devices to first admin user
- Made `user_id` NOT NULL

#### 2. JWT Middleware
**File:** `itam-saas/Agent/middleware/auth.js`
- Added `getRolePermissions(role)` - Returns permission arrays
- Added `authorize(...permissions)` - Checks if user has permission
- Updated `generateToken(user)` - Includes role and permissions in JWT
- Changed JWT structure from `{ id, ... }` to `{ userId, ... }`

#### 3. API Endpoints
**File:** `itam-saas/Agent/server.js`
- Updated all endpoints to extract `userId` from JWT
- Added `await db.setCurrentUserId(userId)` before queries
- Added `user_id` parameter to device/usage creation

**Updated Endpoints:**
- `POST /api/agent/usage`
- `GET /api/agent/devices`
- `GET /api/agent/devices/:deviceId/usage`
- `GET /api/agent/apps/usage`
- `POST /api/agent/heartbeat`

#### 4. Database Queries
**File:** `itam-saas/Agent/queries.js`
- Added `setCurrentUserId(userId)` - Sets PostgreSQL session variable
- Updated `upsertDevice()` - Accepts and stores `user_id`
- Updated `insertUsageData()` - Accepts and stores `user_id`

### Key Functions

#### `setCurrentUserId(userId)`
```javascript
export async function setCurrentUserId(userId) {
  await pool.query('SET app.current_user_id = $1', [userId]);
}
```
**What it does:**
- Sets PostgreSQL session variable for current connection
- RLS policies read this variable to filter queries
- Must be called BEFORE any database query

**Important Fix:**
- Use `SET` (not `SET LOCAL`)
- `SET LOCAL` only works in transactions
- With connection pooling, `SET` persists for the session

---

## Lessons Learned & Fixes

### Bug #1: Wrong Table Name in Migration
**Problem:** Migration failed with "column 'username' does not exist"

**Cause:** Used `users` table name, but actual table is `auth_users`

**Fix:** Updated all table references in migration from `users` to `auth_users`

**Lesson:** Always verify exact table names in schema before writing migrations

---

### Bug #2: SET LOCAL vs SET
**Problem:** API returned 500 error after calling `setCurrentUserId()`

**Cause:** Used `SET LOCAL app.current_user_id = $1` which only works in transactions

**Fix:** Changed to `SET app.current_user_id = $1` (works with connection pooling)

**Lesson:** 
- `SET LOCAL` = only for current transaction (must be inside BEGIN/COMMIT)
- `SET` = for entire session (works with pooled connections)
- Connection pooling reuses connections, so `SET` is correct choice

---

### Bug #3: SET Command with Parameterized Queries ⚠️ CRITICAL
**Problem:** Error: `syntax error at or near "$1"` when calling `setCurrentUserId()`

**Cause:** PostgreSQL's `SET` command does NOT support parameterized queries like `SET app.current_user_id = $1`

**Fix:** Use `set_config()` function instead:
```javascript
// WRONG - Causes syntax error:
await pool.query('SET app.current_user_id = $1', [userId]);

// CORRECT - Works perfectly:
await pool.query("SELECT set_config('app.current_user_id', $1, false)", [userId.toString()]);
```

**Lesson:** 
- `SET` command in PostgreSQL doesn't support `$1` placeholders
- Use `set_config(setting_name, new_value, is_local)` function for dynamic values
- `is_local=false` means variable persists for entire session (not just transaction)
- Must convert userId to string with `.toString()` for set_config()
- This was the FINAL fix that made multi-tenancy work in production!

---

### Bug #4: JWT Key Inconsistency
**Problem:** Frontend couldn't read userId from JWT

**Cause:** Backend used `{ id: user.id }`, frontend expected `{ userId: ... }`

**Fix:** Changed JWT payload from `id` to `userId`

**Lesson:** Maintain consistent naming between frontend and backend

---

### Bug #5: Missing user_id in Device Creation
**Problem:** Foreign key violation when creating devices

**Cause:** Devices table now has `user_id NOT NULL`, but code didn't pass it

**Fix:** Added `user_id: userId` to all `upsertDevice()` and `insertUsageData()` calls

**Lesson:** After schema changes, update ALL code paths that insert data

---

## Summary of All Bugs Fixed

1. ❌ Wrong table name (`users` vs `auth_users`) → ✅ Verified schema first
2. ❌ SET LOCAL doesn't work with pooling → ✅ Used SET instead  
3. ❌ **SET command doesn't support $1 parameters** → ✅ **Used set_config() function** 🔑
4. ❌ JWT key mismatch (`id` vs `userId`) → ✅ Consistent naming
5. ❌ Missing user_id in inserts → ✅ Added to all device/usage creation

**The Critical Fix:** Bug #3 was the final issue - PostgreSQL's `SET` command cannot be parameterized. Using `set_config('app.current_user_id', $1, false)` solved it!

---

## Testing Multi-Tenancy

### Step 1: Create Admin User
```bash
cd itam-saas/Agent
node create-admin.js
# Admin created: admin / admin@itasset.local / admin123
```

### Step 2: Create Regular User
```bash
# Register via API or frontend at /register
# User gets role='user' by default
```

### Step 3: Test with Agent
```bash
# Install Tauri agent on a device
# Login as regular user
# Agent should only see that user's devices
```

### Step 4: Test Admin Access
```bash
# Login to dashboard as admin
# Admin should see ALL devices from ALL users
```

### Step 5: Test User Access
```bash
# Login to dashboard as regular user
# User should ONLY see their own devices
```

### Verification Queries (PostgreSQL)
```sql
-- Check all users and their roles
SELECT id, username, email, role FROM auth_users;

-- Check devices and their owners
SELECT device_id, hostname, user_id FROM devices;

-- Check if admin can see all devices (should return all)
SET app.current_user_id = 1; -- Assuming admin has ID=1
SELECT * FROM devices;

-- Check if user can only see own devices (should return filtered)
SET app.current_user_id = 2; -- Assuming user has ID=2
SELECT * FROM devices;
```

---

## Summary

### What We Implemented
✅ Row-Level Security (RLS) at database level  
✅ Role-based access control (admin vs user)  
✅ Permission-based authorization middleware  
✅ JWT tokens with role and permissions  
✅ Multi-layer security (defense-in-depth)  

### Security Benefits
🛡️ **Defense-in-Depth:** App layer + Database layer security  
🛡️ **Zero-Trust:** Every request authenticated, every query filtered  
🛡️ **Admin Control:** Superuser can see everything, regular users isolated  
🛡️ **Data Isolation:** Users can't access other users' data (even via SQL injection)  

### Admin System
👤 **First Admin:** Created with `node create-admin.js`  
👤 **Default Creds:** admin / admin@itasset.local / admin123  
👤 **Storage:** auth_users table with role='admin'  
👤 **Access:** Sees all devices, all users, all data  

---

**Last Updated:** December 25, 2025  
**Status:** ✅ Multi-tenancy implemented and working
