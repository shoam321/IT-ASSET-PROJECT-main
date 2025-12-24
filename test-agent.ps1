# Quick Agent Test Script
# Run this after copying your full auth token

Write-Host "`n=== IT Asset Agent Test ===" -ForegroundColor Cyan
Write-Host "This script will test the agent API endpoints`n" -ForegroundColor White

# Get token from user
$token = Read-Host "Paste your full auth token (from browser console: localStorage.getItem('token'))"

if (-not $token) {
    Write-Host "❌ No token provided. Exiting." -ForegroundColor Red
    exit
}

# Setup
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
$deviceId = "test-device-" + (Get-Random -Maximum 9999)
$timestamp = [int][double]::Parse((Get-Date -UFormat %s))

Write-Host "`n📡 Testing device heartbeat..." -ForegroundColor Cyan
Write-Host "Device ID: $deviceId" -ForegroundColor Gray

# Test 1: Heartbeat
try {
    $heartbeatBody = @{
        device_id = $deviceId
        timestamp = $timestamp
    } | ConvertTo-Json

    $result = Invoke-RestMethod `
        -Uri "https://it-asset-project-production.up.railway.app/api/agent/heartbeat" `
        -Method POST `
        -Headers $headers `
        -Body $heartbeatBody

    Write-Host "✅ Heartbeat successful!" -ForegroundColor Green
    Write-Host "Response: $($result | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Heartbeat failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    exit
}

# Test 2: Usage Data
Write-Host "`n📊 Sending usage data..." -ForegroundColor Cyan

try {
    $usageBody = @{
        device_id = $deviceId
        app_name = "Visual Studio Code"
        window_title = "Testing IT Asset Agent"
        duration = 60
        timestamp = $timestamp
    } | ConvertTo-Json

    $result = Invoke-RestMethod `
        -Uri "https://it-asset-project-production.up.railway.app/api/agent/usage" `
        -Method POST `
        -Headers $headers `
        -Body $usageBody

    Write-Host "✅ Usage data sent!" -ForegroundColor Green
    Write-Host "Response: $($result | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Usage data failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Gray
    exit
}

# Test 3: Send app list
Write-Host "`n📱 Sending app list..." -ForegroundColor Cyan

try {
    $appsBody = @{
        device_id = $deviceId
        apps = @(
            @{ app_name = "Visual Studio Code"; installed_version = "1.85.0" }
            @{ app_name = "Google Chrome"; installed_version = "120.0" }
            @{ app_name = "Microsoft Edge"; installed_version = "120.0" }
        )
        timestamp = $timestamp
    } | ConvertTo-Json -Depth 5

    $result = Invoke-RestMethod `
        -Uri "https://it-asset-project-production.up.railway.app/api/agent/apps" `
        -Method POST `
        -Headers $headers `
        -Body $appsBody

    Write-Host "✅ App list sent!" -ForegroundColor Green
    Write-Host "Response: $($result | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️ App list failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Response: $($_.ErrorDetails.Message)" -ForegroundColor Gray
}

Write-Host "`n🎉 All tests completed successfully!" -ForegroundColor Green
Write-Host "`n📊 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Refresh the Usage Monitor page in your web app" -ForegroundColor White
Write-Host "  2. You should see device '$deviceId' listed" -ForegroundColor White
Write-Host "  3. Click on it to see the usage data" -ForegroundColor White
Write-Host ""
