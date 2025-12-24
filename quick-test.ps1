Write-Host "=== IT Asset Agent Quick Test ===" -ForegroundColor Cyan

# Login
Write-Host "`nLogging in as admin..." -ForegroundColor Yellow
$loginBody = '{"username":"admin","password":"SecureAdmin2025"}'

try {
    $login = Invoke-RestMethod -Uri "https://it-asset-project-production.up.railway.app/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    $token = $login.token
    Write-Host "Login successful!" -ForegroundColor Green
} catch {
    Write-Host "Login failed: $_" -ForegroundColor Red
    exit
}

# Setup
$headers = @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"}
$deviceId = "test-$env:COMPUTERNAME-$(Get-Random -Max 999)"
$timestamp = [int][double]::Parse((Get-Date -UFormat %s))

# Heartbeat
Write-Host "`nSending heartbeat..." -ForegroundColor Yellow
$hbBody = @{device_id=$deviceId; timestamp=$timestamp} | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "https://it-asset-project-production.up.railway.app/api/agent/heartbeat" -Method POST -Headers $headers -Body $hbBody | Out-Null
    Write-Host "Heartbeat sent! Device: $deviceId" -ForegroundColor Green
} catch {
    Write-Host "Heartbeat failed: $_" -ForegroundColor Red
}

# Usage data
Write-Host "`nSending usage data..." -ForegroundColor Yellow
$usage = @{device_id=$deviceId; app_name="VS Code"; window_title="Testing"; duration=120; timestamp=$timestamp} | ConvertTo-Json
try {
    Invoke-RestMethod -Uri "https://it-asset-project-production.up.railway.app/api/agent/usage" -Method POST -Headers $headers -Body $usage | Out-Null
    Write-Host "Usage data sent!" -ForegroundColor Green
} catch {
    Write-Host "Usage failed: $_" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Green
Write-Host "Check the Usage Monitor page for device: $deviceId" -ForegroundColor Cyan
