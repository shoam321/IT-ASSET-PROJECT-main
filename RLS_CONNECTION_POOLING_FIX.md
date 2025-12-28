# RLS Connection Pooling Fix

## Problem

The application was experiencing RLS (Row-Level Security) policy violations when trying to insert data into the `device_usage` table:

```
ERROR: new row violates row-level security policy for table "device_usage"
```

### Root Cause

**Connection pooling was causing RLS session variables to be set on different database connections than the queries that needed them.**

Here's what was happening:

1. `setCurrentUserId(7)` executes → Gets connection A from pool → Sets `app.current_user_id = 7` on connection A → Returns connection A to pool
2. `insertUsageData(...)` executes → Gets connection B from pool → Connection B doesn't have `app.current_user_id` set! → RLS policy blocks the insert

The RLS policy requires:
```sql
WITH CHECK (
    user_id = current_setting('app.current_user_id', true)::integer
    OR EXISTS (SELECT 1 FROM auth_users WHERE id = current_setting('app.current_user_id', true)::integer AND role = 'admin')
)
```

But `current_setting('app.current_user_id', true)` on connection B returns NULL or empty, so the check fails.

## Solution

Created a new `withRLSContext()` function that:
1. Gets ONE dedicated client from the connection pool
2. Sets the RLS session variable on THAT specific client
3. Executes all queries using the SAME client
4. Releases the client back to the pool when done

### Code Changes

#### 1. Added `withRLSContext()` to queries.js

```javascript
/**
 * Execute a query with RLS context properly set using a dedicated client from the pool
 * This ensures that the session variable and the query execute on the same connection
 */
export async function withRLSContext(userId, callback) {
  const client = await pool.connect();
  try {
    console.log(`🔐 Setting app.current_user_id = ${userId}`);
    
    // Set the session variable on THIS specific client connection
    await client.query("SELECT set_config('app.current_user_id', $1, false)", [userId.toString()]);
    
    // Verify it was set (on the same connection)
    const verify = await client.query("SELECT current_setting('app.current_user_id', true) as value");
    console.log(`✅ Verified app.current_user_id = ${verify.rows[0].value}`);
    
    // Execute the callback with the same client
    return await callback(client);
  } finally {
    // Always release the client back to the pool
    client.release();
  }
}
```

#### 2. Updated `upsertDevice()` and `insertUsageData()` to accept optional client parameter

```javascript
export async function upsertDevice(deviceData, client = null) {
  const queryClient = client || pool;
  const result = await queryClient.query(/* ... */);
  // ...
}

export async function insertUsageData(usageData, client = null) {
  const queryClient = client || pool;
  const result = await queryClient.query(/* ... */);
  // ...
}
```

#### 3. Updated server.js usage endpoint to use `withRLSContext()`

```javascript
app.post('/api/agent/usage', authenticateToken, async (req, res) => {
  const { userId } = req.user;
  
  // Use withRLSContext to ensure RLS variable and queries use the SAME database connection
  const usageData = await db.withRLSContext(userId, async (client) => {
    // Ensure device exists first (auto-create if needed)
    await db.upsertDevice({
      device_id: canonicalDeviceId,
      user_id: userId,
      // ...
    }, client);

    // Insert usage data using the same client
    return await db.insertUsageData({
      device_id: canonicalDeviceId,
      user_id: userId,
      // ...
    }, client);
  });

  res.status(201).json({ message: 'Usage data recorded', data: usageData });
});
```

## Benefits

1. **Fixes RLS violations**: Session variable and queries now execute on the same connection
2. **Maintains connection pooling**: Still uses connection pools efficiently
3. **Thread-safe**: Each request gets its own dedicated client from the pool
4. **Clean error handling**: `finally` block ensures client is always released
5. **Backward compatible**: Functions still work with `pool` if no client is passed

## Testing

After deploying this fix, the error should disappear:

**Before:**
```
ERROR: new row violates row-level security policy for table "device_usage"
POST /api/agent/usage -> 500
```

**After:**
```
✅ Verified app.current_user_id = 7
POST /api/agent/usage -> 201
```

## Lessons Learned

1. **Connection pooling + session variables = danger**: Always use a dedicated client when setting session variables
2. **RLS requires same connection**: Session-level settings like `set_config()` are per-connection
3. **Use client.query() not pool.query()**: When you need session state to persist across multiple queries
4. **Always release clients**: Use try/finally to ensure clients return to the pool

## Related Files

- `itam-saas/Agent/queries.js` - Added `withRLSContext()` function
- `itam-saas/Agent/server.js` - Updated `/api/agent/usage` endpoint
- `itam-saas/Agent/migrations/add-multi-tenancy.sql` - Original RLS policies
- `itam-saas/Agent/migrations/fix-rls-security-breach.sql` - Tightened RLS policies

## Date
December 28, 2025
