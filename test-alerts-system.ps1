# Test Alerts System
# This script helps diagnose why alerts are not appearing

Write-Host "=== IT Asset Tracker - Alerts System Diagnostic ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Get auth token from browser
Write-Host "Step 1: Testing Backend Connection" -ForegroundColor Yellow
Write-Host "Please paste your auth token from localStorage (from browser console: localStorage.getItem('authToken'))"
Write-Host "Token: " -NoNewline -ForegroundColor Green
$token = Read-Host

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "❌ No token provided. Exiting." -ForegroundColor Red
    exit
}

$headers = @{
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
}

$baseUrl = "https://it-asset-project-production.up.railway.app"

# Step 2: Check forbidden apps
Write-Host "`nStep 2: Checking Forbidden Apps Configuration" -ForegroundColor Yellow
try {
    $forbiddenApps = Invoke-RestMethod -Uri "$baseUrl/api/forbidden-apps" -Headers $headers -Method Get
    Write-Host "✅ Found $($forbiddenApps.Count) forbidden apps configured:" -ForegroundColor Green
    $forbiddenApps | Format-Table -Property id, process_name, severity, description
    
    if ($forbiddenApps.Count -eq 0) {
        Write-Host "⚠️  NO FORBIDDEN APPS CONFIGURED!" -ForegroundColor Red
        Write-Host "   This is why you're not seeing alerts." -ForegroundColor Red
        Write-Host "   Go to Forbidden Apps tab and add some apps to monitor." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   Suggested apps to monitor:" -ForegroundColor Cyan
        Write-Host "   - chrome.exe (Browser)" -ForegroundColor White
        Write-Host "   - spotify.exe (Music)" -ForegroundColor White
        Write-Host "   - discord.exe (Chat)" -ForegroundColor White
        Write-Host "   - telegram.exe (Messaging)" -ForegroundColor White
        exit
    }
} catch {
    Write-Host "❌ Failed to fetch forbidden apps: $_" -ForegroundColor Red
    exit
}

# Step 3: Check existing alerts
Write-Host "`nStep 3: Checking Existing Alerts" -ForegroundColor Yellow
try {
    $alerts = Invoke-RestMethod -Uri "$baseUrl/api/alerts?limit=50" -Headers $headers -Method Get
    Write-Host "✅ Found $($alerts.Count) alerts in the system:" -ForegroundColor Green
    if ($alerts.Count -gt 0) {
        $alerts | Select-Object -First 10 | Format-Table -Property id, device_id, app_detected, severity, status, created_at
    } else {
        Write-Host "   No alerts yet. Waiting for agent to detect violations..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to fetch alerts: $_" -ForegroundColor Red
}

# Step 4: Check if agent is running
Write-Host "`nStep 4: Checking if Tauri Agent is Running" -ForegroundColor Yellow
$agentProcess = Get-Process -Name "tauriagent*" -ErrorAction SilentlyContinue
if ($agentProcess) {
    Write-Host "✅ Tauri Agent is running (PID: $($agentProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "❌ Tauri Agent is NOT running!" -ForegroundColor Red
    Write-Host "   Please start the agent from: itam-saas\TauriAgent\" -ForegroundColor Yellow
}

# Step 5: Test manual alert creation
Write-Host "`nStep 5: Testing Manual Alert Creation" -ForegroundColor Yellow
Write-Host "Do you want to create a test alert? (y/n): " -NoNewline
$createTest = Read-Host

if ($createTest -eq 'y') {
    $testAlert = @{
        device_id = "$env:COMPUTERNAME"
        app_detected = "test.exe"
        severity = "Medium"
        process_id = 12345
    } | ConvertTo-Json

    try {
        $result = Invoke-RestMethod -Uri "$baseUrl/api/alerts" -Headers $headers -Method Post -Body $testAlert
        Write-Host "✅ Test alert created successfully!" -ForegroundColor Green
        Write-Host "   Alert ID: $($result.id)" -ForegroundColor Cyan
        Write-Host "   Check the Security Alerts tab in your dashboard now." -ForegroundColor Yellow
    } catch {
        Write-Host "❌ Failed to create test alert: $_" -ForegroundColor Red
        Write-Host "   Error details:" -ForegroundColor Yellow
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

Write-Host "`n=== Diagnostic Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "1. If you have 0 forbidden apps → Add them via the dashboard" -ForegroundColor White
Write-Host "2. If agent is not running → Start it from itam-saas\TauriAgent\" -ForegroundColor White
Write-Host "3. If you created a test alert → Check the Security Alerts tab" -ForegroundColor White
Write-Host ""
