# Start Frontend Server
Write-Host "🚀 Starting IT Asset Frontend Client..." -ForegroundColor Green
Write-Host "Frontend will run on http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

cd "itam-saas/Client"

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Start the frontend
Write-Host "Starting frontend..." -ForegroundColor Green
npm start

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend failed to start!" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor Red
    pause
}
