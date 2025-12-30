# ============================================================================
# CRITICAL: Environment Variables for Railway Deployment
# ============================================================================
# Add these to your Railway service environment variables

# ============================================================================
# DATABASE CONFIGURATION
# ============================================================================
# These should already be set by Railway, but verify:
DATABASE_URL=postgresql://postgres:password@caboose.proxy.rlwy.net:31886/railway?sslmode=require

# ============================================================================
# SESSION STORE - USE POSTGRESQL (NOT MEMORY STORE)
# ============================================================================
# This fixes the "MemoryStore is not designed for production" error
USE_PG_SESSION=true
SESSION_SECRET=your-super-secret-session-key-generate-with-openssl-rand-hex-32

# ============================================================================
# DATABASE CREDENTIALS (If not in DATABASE_URL)
# ============================================================================
DB_USER=itam_app
DB_PASSWORD=ITAssetApp@2025
DB_HOST=caboose.proxy.rlwy.net
DB_PORT=31886
DB_NAME=railway

# ============================================================================
# GRAFANA INTEGRATION
# ============================================================================
REACT_APP_GRAFANA_URL=https://grafana-production-f114.up.railway.app
GRAFANA_URL=https://grafana-production-f114.up.railway.app

# ============================================================================
# AUTHENTICATION & SECURITY
# ============================================================================
JWT_SECRET=your-jwt-secret-key-change-this
NODE_ENV=production

# ============================================================================
# APPLICATION CONFIGURATION
# ============================================================================
PORT=3000
LOG_LEVEL=info

# ============================================================================
# GENERATE SECURE KEYS (Run locally):
# ============================================================================
# For SESSION_SECRET:
#   openssl rand -hex 32
#
# For JWT_SECRET:
#   openssl rand -hex 32
# ============================================================================
