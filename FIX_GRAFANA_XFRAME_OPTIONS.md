# Fix Grafana X-Frame-Options 'deny' Error

## Problem
Grafana is blocking iframe embedding with `X-Frame-Options: deny` header.

## Solution
Add these environment variables to your **Grafana service** on Railway:

### Required Environment Variables

```bash
# Allow embedding in iframes
GF_SECURITY_ALLOW_EMBEDDING=true

# Configure cookie settings for cross-origin
GF_SECURITY_COOKIE_SAMESITE=none
GF_SECURITY_COOKIE_SECURE=true

# Allow your frontend domain
GF_SERVER_ROOT_URL=https://grafana-production-f114.up.railway.app

# Disable X-Frame-Options deny (or set to SAMEORIGIN)
GF_SECURITY_X_FRAME_OPTIONS=SAMEORIGIN
```

### Alternative (More Permissive - Use with Caution)
If you need to embed from multiple domains:

```bash
GF_SECURITY_ALLOW_EMBEDDING=true
GF_SECURITY_COOKIE_SAMESITE=none
GF_SECURITY_COOKIE_SECURE=true
# This allows embedding from any domain - only use if needed
```

## Step-by-Step Fix on Railway

### Method 1: Railway Web Dashboard (Recommended)

1. Go to [railway.app](https://railway.app)
2. Open your project: **extraordinary-quietude**
3. Select the **Grafana** service (not IT-ASSET-PROJECT)
4. Click **Variables** tab
5. Add these new variables:

   | Variable Name | Value |
   |---------------|-------|
   | `GF_SECURITY_ALLOW_EMBEDDING` | `true` |
   | `GF_SECURITY_COOKIE_SAMESITE` | `none` |
   | `GF_SECURITY_COOKIE_SECURE` | `true` |

6. Optional but recommended:
   
   | Variable Name | Value |
   |---------------|-------|
   | `GF_SECURITY_X_FRAME_OPTIONS` | `SAMEORIGIN` |

7. Click **Deploy** (Railway will restart Grafana with new settings)
8. Wait 1-2 minutes for deployment to complete

### Method 2: Railway CLI

```powershell
# Link to Grafana service
railway service

# Select Grafana from the list

# Add variables
railway variables set GF_SECURITY_ALLOW_EMBEDDING=true
railway variables set GF_SECURITY_COOKIE_SAMESITE=none
railway variables set GF_SECURITY_COOKIE_SECURE=true

# Deploy
railway up
```

## Verify the Fix

After deployment completes:

1. **Clear browser cache** (important!)
2. Refresh your frontend at `it-asset-project.vercel.app`
3. Check browser console - X-Frame-Options errors should be gone
4. Grafana panels should now display in iframes

## Security Considerations

### Why These Settings Are Safe

- **SAMEORIGIN**: Allows embedding only from the same origin (Grafana itself)
- **ALLOW_EMBEDDING**: Specifically enables iframe embedding feature
- **COOKIE_SAMESITE=none**: Required for cross-site embedding
- **COOKIE_SECURE=true**: Ensures cookies only sent over HTTPS

### Additional Security (Optional)

If you want to restrict embedding to only your frontend domain, you can use a reverse proxy or configure Content Security Policy. For Railway/Grafana, the settings above are the standard approach.

### Production Best Practices

1. ✅ Always use HTTPS (already configured)
2. ✅ Use strong admin passwords (check Railway env vars)
3. ✅ Enable anonymous access only if needed
4. ✅ Use read-only database user for data sources (already configured)
5. ⚠️ Monitor Grafana access logs periodically

## Troubleshooting

### If X-Frame-Options errors persist:

1. **Verify variables were added correctly**:
   - Check Railway dashboard → Grafana service → Variables
   - Ensure no typos in variable names

2. **Confirm deployment completed**:
   - Check Railway logs for successful restart
   - Look for Grafana initialization messages

3. **Clear browser cache**:
   ```
   Chrome/Edge: Ctrl+Shift+Delete → Clear cached images and files
   Firefox: Ctrl+Shift+Delete → Clear cache
   ```

4. **Check browser console for other errors**:
   - CSP (Content Security Policy) violations
   - CORS errors
   - Authentication issues

5. **Test Grafana directly**:
   - Open `https://grafana-production-f114.up.railway.app` in new tab
   - Verify dashboards load
   - Check if you can access panels directly

### If panels still don't load:

The issue might be authentication. Consider:
- Enabling anonymous access for dashboards
- Or configure Grafana authentication to work with your app

## Enable Anonymous Access (Optional)

If you want dashboards to load without login:

```bash
# Add to Grafana service variables
GF_AUTH_ANONYMOUS_ENABLED=true
GF_AUTH_ANONYMOUS_ORG_NAME=Main Org.
GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
```

⚠️ **Security Warning**: Only enable anonymous access if dashboards don't contain sensitive data, or if you have other access controls in place.

## Next Steps After Fix

1. Test all embedded panels in your dashboard
2. Verify data loads correctly
3. Check panel refresh rates
4. Optimize queries if panels are slow
5. Document which panelIds map to which visualizations

## Reference

- [Grafana Configuration Docs](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/)
- [Grafana Security Settings](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/)
- [Embedding Grafana Panels](https://grafana.com/docs/grafana/latest/dashboards/share-dashboards-panels/)
