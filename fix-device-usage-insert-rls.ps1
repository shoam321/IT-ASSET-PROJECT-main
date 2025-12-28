# ========================================
# Fix device_usage INSERT RLS Policy on Railway
# ========================================

Write-Host "🔧 Fixing device_usage INSERT RLS Policy..." -ForegroundColor Cyan
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "❌ ERROR: DATABASE_URL environment variable is not set!" -ForegroundColor Red
    Write-Host "Please set it with your Railway PostgreSQL connection string:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL = "postgresql://user:password@host:port/database"' -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ DATABASE_URL is set" -ForegroundColor Green

# Read the SQL fix script
$sqlScript = Get-Content "FIX-DEVICE-USAGE-INSERT-RLS.sql" -Raw

# Create a temporary file for psql
$tempSqlFile = "temp-fix-rls.sql"
$sqlScript | Out-File -FilePath $tempSqlFile -Encoding UTF8

Write-Host ""
Write-Host "📝 Applying RLS fix to database..." -ForegroundColor Cyan

# Execute the SQL script using psql
try {
    # Check if psql is available
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    
    if ($psqlPath) {
        Write-Host "Using psql to execute SQL..." -ForegroundColor Yellow
        psql $env:DATABASE_URL -f $tempSqlFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ RLS policy fix applied successfully!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ Failed to apply RLS policy fix" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ psql not found. Please install PostgreSQL client tools." -ForegroundColor Red
        Write-Host ""
        Write-Host "Alternative: Copy the contents of FIX-DEVICE-USAGE-INSERT-RLS.sql" -ForegroundColor Yellow
        Write-Host "and run it in Railway's PostgreSQL query interface." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clean up temporary file
    if (Test-Path $tempSqlFile) {
        Remove-Item $tempSqlFile
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🎉 Device usage INSERT RLS policy has been fixed!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "What was fixed:" -ForegroundColor Yellow
Write-Host "  ✓ Users can now insert usage data for their own devices" -ForegroundColor White
Write-Host "  ✓ Device ownership is verified before insertion" -ForegroundColor White
Write-Host "  ✓ Admins can insert usage data for any device" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Restart your backend server" -ForegroundColor White
Write-Host "  2. Monitor the logs for RLS errors" -ForegroundColor White
Write-Host "  3. Test device usage data insertion" -ForegroundColor White
Write-Host ""
