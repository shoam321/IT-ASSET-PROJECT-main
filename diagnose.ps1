# Troubleshooting Script
Write-Host "🔍 IT Asset Project - Diagnostic Tool" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Backend Health
Write-Host "1️⃣  Checking Backend (Port 5000)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Backend is RUNNING" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is NOT running" -ForegroundColor Red
    Write-Host "   Solution: Run 'start-backend.ps1' in another terminal" -ForegroundColor Yellow
}

Write-Host ""

# Check Frontend
Write-Host "2️⃣  Checking Frontend (Port 3000)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Frontend is RUNNING" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend is NOT running" -ForegroundColor Red
    Write-Host "   Solution: Run 'start-frontend.ps1' in another terminal" -ForegroundColor Yellow
}

Write-Host ""

# Check PostgreSQL
Write-Host "3️⃣  Checking PostgreSQL (Port 5432)..." -ForegroundColor Yellow
if ((netstat -ano | findstr ":5432") -ne $null) {
    Write-Host "✅ PostgreSQL appears to be RUNNING" -ForegroundColor Green
} else {
    Write-Host "❌ PostgreSQL might not be running" -ForegroundColor Red
    Write-Host "   Solution: Start PostgreSQL service" -ForegroundColor Yellow
}

Write-Host ""

# Check Node Processes
Write-Host "4️⃣  Running Node Processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses.Count -gt 0) {
    Write-Host "✅ Found $($nodeProcesses.Count) Node process(es)" -ForegroundColor Green
    foreach ($proc in $nodeProcesses) {
        Write-Host "   - PID: $($proc.Id), Name: $($proc.ProcessName)" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  No Node processes running" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "   • Backend should show ✅ (running on :5000)" -ForegroundColor White
Write-Host "   • Frontend should show ✅ (running on :3000)" -ForegroundColor White
Write-Host "   • PostgreSQL should show ✅" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Quick Fixes:" -ForegroundColor Yellow
Write-Host "   • Backend error? → Run: start-backend.ps1" -ForegroundColor White
Write-Host "   • Frontend error? → Run: start-frontend.ps1" -ForegroundColor White
Write-Host "   • Port in use? → Run: netstat -ano | findstr :XXXX" -ForegroundColor White
Write-Host ""

pause
