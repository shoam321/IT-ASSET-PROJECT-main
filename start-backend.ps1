# Start Backend Server
Write-Host "🚀 Starting IT Asset Backend Server..." -ForegroundColor Green
Write-Host "Server will run on http://localhost:5000" -ForegroundColor Cyan
Write-Host ""

cd "itam-saas/Agent"

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Start the server
Write-Host "Starting server..." -ForegroundColor Green
npm start

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Server failed to start!" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor Red
    pause
}
