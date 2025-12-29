# Get Grafana Service Information from Railway

Write-Host "=== Railway Grafana Service Information ===" -ForegroundColor Cyan
Write-Host ""

# Check if Railway CLI is available
$railwayCli = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayCli) {
    Write-Host "ERROR: Railway CLI not found" -ForegroundColor Red
    Write-Host "Install with: npm i -g @railway/cli" -ForegroundColor Yellow
    Write-Host "Then run: railway login" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1] Listing all services..." -ForegroundColor Yellow
railway service list

Write-Host ""
Write-Host "[2] Current project info..." -ForegroundColor Yellow
railway status

Write-Host ""
Write-Host "[3] Checking for Grafana service..." -ForegroundColor Yellow
Write-Host "If you see a Grafana service above, run:" -ForegroundColor White
Write-Host "  railway logs --service <service-name>" -ForegroundColor Cyan
Write-Host ""
Write-Host "To switch to Grafana service:" -ForegroundColor White
Write-Host "  railway service" -ForegroundColor Cyan
Write-Host "  (then select Grafana from the list)" -ForegroundColor Gray
Write-Host ""
Write-Host "To view Grafana environment variables:" -ForegroundColor White  
Write-Host "  railway variables --service <grafana-service-name>" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view Grafana logs:" -ForegroundColor White
Write-Host "  railway logs --service <grafana-service-name>" -ForegroundColor Cyan
Write-Host ""

# Try to detect Grafana service
Write-Host "[4] Attempting to detect Grafana deployment..." -ForegroundColor Yellow
$services = railway service list 2>&1 | Out-String
if ($services -match "grafana|Grafana") {
    Write-Host "Found Grafana service!" -ForegroundColor Green
    Write-Host $services
} else {
    Write-Host "No Grafana service found in project" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You may need to deploy Grafana first." -ForegroundColor Yellow
    Write-Host "See: deploy-grafana-railway.md for instructions" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=== What to share ===" -ForegroundColor Cyan
Write-Host "Copy and share the output above to help diagnose issues" -ForegroundColor White
Write-Host ""
