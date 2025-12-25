# Test Forbidden Apps Locally
# This will start the frontend locally to verify the feature works

Write-Host "🧪 Testing Forbidden Apps Locally" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to Client directory
$clientPath = "itam-saas\Client"
if (-not (Test-Path $clientPath)) {
    Write-Host "❌ Client directory not found" -ForegroundColor Red
    exit
}

Write-Host "📂 Navigating to Client directory..." -ForegroundColor Yellow
Set-Location $clientPath

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

Write-Host "✅ Starting development server..." -ForegroundColor Green
Write-Host ""
Write-Host "The app will open in your browser at: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Login Credentials:" -ForegroundColor Yellow
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "Then navigate to: Forbidden Apps" -ForegroundColor Cyan
Write-Host "You should see 7 default forbidden applications!" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm start
