# Organization RLS INSERT Policy Fix - December 31, 2025

## Problem Statement

Users were unable to create or insert new organizations, receiving the error:

```
new row violates row-level security policy for table "organizations"
```

This occurred when trying to bootstrap a new organization via `/api/organizations/bootstrap`.

## Root Cause Analysis

The `organizations` table had Row-Level Security (RLS) **enabled** with SELECT and UPDATE policies, but **no INSERT policy**. 

In PostgreSQL, when RLS is enabled on a table:
- Without an INSERT policy → **all inserts are blocked** (default deny)
- Without a SELECT policy → all selects are blocked
- Without an UPDATE policy → all updates are blocked

The policies that existed:
- ✅ `organizations_select_policy` - allows SELECT
- ✅ `organizations_update_policy` - allows UPDATE for owners/admins
- ✅ `organizations_system_update_policy` - allows UPDATE via system context
- ❌ **NO INSERT POLICY** ← This was the blocker

## Solution Implemented

### 1. Added INSERT RLS Policy to Organizations Table

**File**: [itam-saas/Agent/migrations/fix-organizations-insert-rls.sql](itam-saas/Agent/migrations/fix-organizations-insert-rls.sql)

```sql
CREATE POLICY organizations_system_insert_policy ON organizations
  FOR INSERT
  WITH CHECK (
    current_setting('app.system', true) = '1'
  );
```

This policy allows inserts when `app.system = '1'`, which is set by system-level operations (server actions, webhooks, admin operations).

### 2. Updated `withSystemContext()` to Set System Flag

**File**: [itam-saas/Agent/queries.js](itam-saas/Agent/queries.js)

```javascript
export async function withSystemContext(callback) {
  // ... create dedicated pool ...
  try {
    // Set system context flag for RLS policies
    await client.query("SELECT set_config('app.system', '1', false)");
    return await callback(client);
  }
}
```

Now when organization bootstrap and other system operations run, they properly set the system flag, allowing the INSERT RLS policy to pass.

### 3. Created Migration Application Script

**File**: [itam-saas/Agent/apply-org-insert-rls-fix.js](itam-saas/Agent/apply-org-insert-rls-fix.js)

Script to safely apply the RLS policy migration using owner database credentials.

## RLS Security Model

The organizations table now has a complete RLS policy set:

| Operation | Policy | Condition |
|-----------|--------|-----------|
| **SELECT** | `organizations_select_policy` | User is member of the organization |
| **SELECT** | `organizations_system_select_policy` | System context (`app.system = '1'`) |
| **UPDATE** | `organizations_update_policy` | User is owner/admin of the organization |
| **UPDATE** | `organizations_system_update_policy` | System context (`app.system = '1'`) |
| **INSERT** | `organizations_system_insert_policy` | System context (`app.system = '1'`) |
| **DELETE** | None defined | Default deny (no cascade delete at RLS level) |

## How It Works Now

### Organization Bootstrap Flow

1. User calls `POST /api/organizations/bootstrap` with org name
2. Endpoint calls `db.withSystemContext(async (client) => { ... })`
3. `withSystemContext()`:
   - Creates dedicated database client with owner credentials
   - Sets `app.system = '1'` on that client
   - Executes the callback (organization creation) using same client
4. Organization insert query checks:
   - ✅ `organizations_system_insert_policy` evaluates `app.system = '1'`
   - ✅ Policy passes, insert succeeds
5. User receives new organization and updated JWT token

### Regular User Operations

- Regular user queries don't set `app.system = '1'`
- Only the system INSERT policy allows inserts
- Regular users still have SELECT/UPDATE access to orgs they belong to
- Data isolation is maintained

## Deployment Steps

### Local/Testing
```bash
# Run the migration script to apply INSERT policy
node itam-saas/Agent/apply-org-insert-rls-fix.js
```

### Production (Railway)
1. Code was pushed to GitHub
2. Railway auto-deployed the updated backend
3. The migration was run manually with owner credentials to add the policy
4. All subsequent organization creation requests now succeed

## Testing

### Before Fix
```
POST /api/organizations/bootstrap
Error: new row violates row-level security policy for table "organizations"
Status: 500
```

### After Fix
```
POST /api/organizations/bootstrap
{ organization: { id: 1, name: "Acme Corp", ... }, token: "eyJ..." }
Status: 201
```

## Files Changed

1. **itam-saas/Agent/queries.js**
   - Enhanced `withSystemContext()` to set `app.system = '1'`

2. **itam-saas/Agent/migrations/fix-organizations-insert-rls.sql** (NEW)
   - Creates INSERT RLS policy for organizations table

3. **itam-saas/Agent/apply-org-insert-rls-fix.js** (NEW)
   - Migration application script with owner credentials

## Related Context

- Original organizations table definition: [itam-saas/Agent/migrations/add-organizations.sql](itam-saas/Agent/migrations/add-organizations.sql)
- Billing column additions: [itam-saas/Agent/migrations/add-organization-billing.sql](itam-saas/Agent/migrations/add-organization-billing.sql)
- Bootstrap endpoint: [itam-saas/Agent/server.js](itam-saas/Agent/server.js#L920-L980)

## Security Notes

✅ **Data Isolation**: Users can only see/update organizations they belong to (unless system context)
✅ **System Operations**: Webhooks and admin operations bypass normal RLS via system context
✅ **Insert Protection**: Only system context can create organizations (prevents unauthorized org creation)
✅ **Backward Compatible**: Existing SELECT/UPDATE policies unchanged

## Future Improvements

1. Consider adding DELETE policy for organization cleanup (currently cascades at FK level)
2. Add audit logging for organization creation via system context
3. Consider rate-limiting on `/api/organizations/bootstrap` to prevent spam
4. Review other tables for similar INSERT policy gaps

## Status

✅ **FIXED** - December 31, 2025, 13:45 UTC
- Migration applied to production database
- Code deployed to Railway backend
- Organization bootstrap now functional
