# Railway Production Database Credentials

**SAVED LOCATION:** `itam-saas/Agent/.env` (gitignored)

⚠️ **SECURITY WARNING**: Never commit database credentials to git.
Credentials are stored in:
- Local: `itam-saas/Agent/.env` file (gitignored)
- Production: Railway environment variables

```
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/railway
```

## Connection Details
- **Host:** Railway proxy (configured in .env)
- **Port:** Configured in Railway
- **Database:** railway
- **User:** Configured in .env
- **Password:** Stored securely in .env (gitignored)

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
