Write-Host "=== Real Data Test ===" -ForegroundColor Cyan

# Login
$loginBody = '{"username":"admin","password":"SecureAdmin2025"}'
$login = Invoke-RestMethod -Uri "https://it-asset-project-production.up.railway.app/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
$token = $login.token
Write-Host "Logged in as: $($login.user.username)" -ForegroundColor Green

$headers = @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"}
$deviceId = "TEST-$env:COMPUTERNAME-$(Get-Date -Format 'HHmmss')"
$timestamp = [int][double]::Parse((Get-Date -UFormat %s))

# Send heartbeat
Write-Host "`nSending heartbeat for: $deviceId" -ForegroundColor Yellow
$hb = @{device_id=$deviceId; timestamp=$timestamp} | ConvertTo-Json
Invoke-RestMethod -Uri "https://it-asset-project-production.up.railway.app/api/agent/heartbeat" -Method POST -Headers $headers -Body $hb | Out-Null
Write-Host "Heartbeat sent!" -ForegroundColor Green

# Send usage data
Write-Host "`nSending usage data..." -ForegroundColor Yellow
$apps = @("Chrome", "VS Code", "Teams", "Outlook", "Slack")
foreach ($app in $apps) {
    $usage = @{device_id=$deviceId; app_name=$app; window_title="Working"; duration=(Get-Random -Min 60 -Max 600); timestamp=$timestamp} | ConvertTo-Json
    Invoke-RestMethod -Uri "https://it-asset-project-production.up.railway.app/api/agent/usage" -Method POST -Headers $headers -Body $usage | Out-Null
    Write-Host "  Sent: $app" -ForegroundColor Gray
}

# Verify
Write-Host "`nVerifying data..." -ForegroundColor Yellow
$devices = Invoke-RestMethod -Uri "https://it-asset-project-production.up.railway.app/api/agent/devices" -Method GET -Headers $headers
Write-Host "Total devices in DB: $($devices.Count)" -ForegroundColor Cyan

$found = $devices | Where-Object { $_.device_id -eq $deviceId }
if ($found) {
    Write-Host "SUCCESS! Device found: $deviceId" -ForegroundColor Green
    
    $usage = Invoke-RestMethod -Uri "https://it-asset-project-production.up.railway.app/api/agent/devices/$deviceId/usage" -Method GET -Headers $headers
    Write-Host "Usage records: $($usage.Count)" -ForegroundColor Green
    
    Write-Host "`nUsage breakdown:" -ForegroundColor Cyan
    $usage | ForEach-Object { Write-Host "  $($_.app_name): $($_.duration)s" -ForegroundColor White }
} else {
    Write-Host "WARNING: Device not found!" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Green
Write-Host "Now check Usage Monitor page for device: $deviceId" -ForegroundColor Cyan
