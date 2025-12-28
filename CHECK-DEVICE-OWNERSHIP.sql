-- Run this in Railway to check what's actually happening
-- Check which user owns which device

SELECT 
    d.device_id,
    d.user_id,
    u.username,
    u.email,
    u.role
FROM devices d
LEFT JOIN auth_users u ON d.user_id = u.id
ORDER BY d.last_seen DESC;
