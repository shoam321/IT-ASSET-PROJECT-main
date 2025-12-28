Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RLS Migration for Production Database" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Loading DATABASE_URL from .env file...`n" -ForegroundColor Yellow

# Load .env file
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^DATABASE_URL=(.+)$') {
            $env:DATABASE_URL = $matches[1]
            Write-Host "✅ DATABASE_URL loaded from .env`n" -ForegroundColor Green
        }
    }
} else {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    exit 1
}
Write-Host "Step 2: Running migration...`n" -ForegroundColor Yellow

node migrations/run-multi-tenancy-migration.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  ✅ Migration Complete!" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
    Write-Host "Row-Level Security is now ENABLED!" -ForegroundColor Cyan
    Write-Host "Users will only see their own devices.`n" -ForegroundColor Cyan
} else {
    Write-Host "`n❌ Migration failed! Check error above.`n" -ForegroundColor Red
    exit 1
}
