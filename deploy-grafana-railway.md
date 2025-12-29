# Deploy Grafana to Railway - Quick Guide

## Step 1: Add Grafana Service to Railway

1. Go to your Railway project: https://railway.app
2. Click **"+ New Service"**
3. Select **"Docker Image"**
4. Enter image: `grafana/grafana:latest`

## Step 2: Configure Environment Variables

Add these variables to the Grafana service:

```
GF_SERVER_ROOT_URL=https://grafana-production-f114.up.railway.app
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=<your-secure-password>
GF_AUTH_ANONYMOUS_ENABLED=false
GF_DATABASE_TYPE=postgres
GF_DATABASE_HOST=caboose.proxy.rlwy.net:31886
GF_DATABASE_NAME=railway
GF_DATABASE_USER=grafana_reader
GF_DATABASE_PASSWORD=GrafanaR3adOnly!2025
GF_DATABASE_SSL_MODE=require
GF_INSTALL_PLUGINS=
PORT=3000
```

## Step 3: Set Domain

1. Go to Grafana service **Settings** → **Networking**
2. Click **"Generate Domain"** or **"Custom Domain"**
3. If the domain is different from `grafana-production-f114.up.railway.app`, you'll need to update your frontend code

## Step 4: Wait for Deployment

- Railway will pull the Grafana Docker image
- Service should be ready in 1-2 minutes
- Check **Logs** tab for any errors

## Step 5: Test Connection

1. Open the Railway domain in a browser
2. Login with admin credentials
3. Configure PostgreSQL data source (see GRAFANA_SETUP.md)

## Alternative: Use Railway Template

Railway has a Grafana template:

1. In Railway project, click **"+ New Service"**
2. Search for "Grafana" in templates
3. Click **"Deploy"**
4. Configure environment variables as above

## Troubleshooting

### Service won't start
- Check logs for errors
- Verify all required environment variables are set
- Ensure PostgreSQL database is accessible

### Domain changed
If Railway assigns a different domain, update these files:
- `itam-saas/Client/src/components/Dashboard.jsx` (line 12)
- `.env` file: `REACT_APP_GRAFANA_URL`

### Connection to database fails
- Verify database credentials in Railway PostgreSQL service
- Ensure `grafana_reader` user exists (run create-grafana-reader.js)
- Check database host is the **public** Railway host

## Current Database Connection Details

- **Host**: caboose.proxy.rlwy.net:31886
- **Database**: railway
- **User**: grafana_reader
- **Password**: GrafanaR3adOnly!2025
- **SSL Mode**: require

Run `node create-grafana-reader.js` to ensure the database user exists.
