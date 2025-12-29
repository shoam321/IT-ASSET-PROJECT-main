# Grafana Connection Diagnostic Script

Write-Host "=== Grafana Connection Diagnostic ===" -ForegroundColor Cyan
Write-Host ""

$grafanaUrl = "https://grafana-production-f114.up.railway.app"

Write-Host "[1/3] Testing Grafana URL..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $grafanaUrl -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Host "SUCCESS: Grafana is accessible!" -ForegroundColor Green
    Write-Host "  Status Code: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "FAILED: Cannot connect to Grafana" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Message -match "refused|timeout|not found|404") {
        Write-Host ""
        Write-Host "Possible causes:" -ForegroundColor Yellow
        Write-Host "  1. Grafana service is not running on Railway" -ForegroundColor Gray
        Write-Host "  2. Service was never deployed" -ForegroundColor Gray
        Write-Host "  3. Domain URL has changed" -ForegroundColor Gray
        Write-Host "  4. Service crashed or was suspended" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "[2/3] Checking Railway CLI status..." -ForegroundColor Yellow
$railwayCli = Get-Command railway -ErrorAction SilentlyContinue
if ($railwayCli) {
    Write-Host "Railway CLI is installed" -ForegroundColor Green
    Write-Host "  Running: railway status" -ForegroundColor Gray
    railway status 2>&1 | Out-String | Write-Host -ForegroundColor Gray
} else {
    Write-Host "Railway CLI not installed" -ForegroundColor Yellow
    Write-Host "  Install: npm i -g @railway/cli" -ForegroundColor Gray
    Write-Host "  Then run: railway login" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[3/3] Checking database connectivity..." -ForegroundColor Yellow
$dbUser = "grafana_reader"
Write-Host "  Database User: $dbUser" -ForegroundColor Gray
Write-Host "  Run this to verify database user:" -ForegroundColor Gray
Write-Host "  node create-grafana-reader.js" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Visit Railway Dashboard: https://railway.app" -ForegroundColor White
Write-Host "2. Check if Grafana service exists in your project" -ForegroundColor White
Write-Host "3. If not, see: deploy-grafana-railway.md for deployment steps" -ForegroundColor White
Write-Host "4. If service exists but is down, click 'Deploy' to restart it" -ForegroundColor White
Write-Host ""
