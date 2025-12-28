# Railway Production Database Credentials

**SAVED LOCATION:** `itam-saas/Agent/.env`

```
DATABASE_URL=postgresql://postgres:KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm@caboose.proxy.rlwy.net:31886/railway
```

## Connection Details
- **Host:** caboose.proxy.rlwy.net
- **Port:** 31886
- **Database:** railway
- **User:** postgres
- **Password:** KOcMWUlOIOsQudIVqzANkoVSWfWTpvDm

## Usage

All scripts now automatically load from `.env` file. No need to input manually.

### Run Migrations
```powershell
cd itam-saas/Agent
.\apply-rls.ps1  # Automatically uses .env
```

### Start Server
```powershell
cd itam-saas/Agent
npm start  # Automatically uses .env via dotenv
```

## Security
- ✅ .env file is in .gitignore (will NOT be committed to git)
- ✅ Credentials stored locally only
- ⚠️ Never share .env file or commit to repository

## Status
- ✅ **RLS Migration Applied** - December 28, 2025
- ✅ Row-Level Security ENABLED on production database
- ✅ Users now isolated - each sees only their own data
