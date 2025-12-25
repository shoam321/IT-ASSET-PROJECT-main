# Create Deployment Package for IT Asset Agent

Write-Host "Creating IT Asset Agent Deployment Package..." -ForegroundColor Cyan

# Paths
$exePath = ".\src-tauri\target\release\tauriagent.exe"
$deploymentFolder = ".\deployment"

# Check if EXE exists
if (-not (Test-Path $exePath)) {
    Write-Host "ERROR: tauriagent.exe not found at $exePath" -ForegroundColor Red
    Write-Host "Please build the agent first with: npm run tauri build" -ForegroundColor Yellow
    exit 1
}

# Create deployment folder
if (Test-Path $deploymentFolder) {
    Remove-Item $deploymentFolder -Recurse -Force
}
New-Item -ItemType Directory -Path $deploymentFolder | Out-Null

# Copy executable
Copy-Item $exePath -Destination $deploymentFolder
Write-Host "[OK] Copied tauriagent.exe" -ForegroundColor Green

# Create README
$readme = @"
IT Asset Monitoring Agent - User Guide
=======================================

QUICK START:
1. Double-click tauriagent.exe
2. Login with your credentials  
3. Minimize to tray - it will keep running

AUTO-START (Optional):
1. Press Win+R, type: shell:startup
2. Create shortcut to tauriagent.exe there

TROUBLESHOOTING:
- Won't start: Run as Administrator
- Can't login: Check internet connection
- Not syncing: Wait 2 minutes, then refresh dashboard

System Requirements: Windows 10/11 64-bit

Support: Contact IT Department
"@

$readme | Out-File -FilePath "$deploymentFolder\README.txt" -Encoding UTF8
Write-Host "[OK] Created README.txt" -ForegroundColor Green

# Create info file
$fileSize = [math]::Round((Get-Item $exePath).Length / 1MB, 2)
$info = @"
Deployment Package Info
========================
Built: $(Get-Date -Format 'yyyy-MM-dd HH:mm')
Version: 0.1.0
Size: $fileSize MB
Platform: Windows x64

API: https://it-asset-project-production.up.railway.app  
Dashboard: https://it-asset-project.vercel.app

Installation: Copy folder to target PC and run tauriagent.exe
"@

$info | Out-File -FilePath "$deploymentFolder\INFO.txt" -Encoding UTF8
Write-Host "[OK] Created INFO.txt" -ForegroundColor Green

# Create ZIP
$zipPath = ".\IT-Asset-Agent-Deployment.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path "$deploymentFolder\*" -DestinationPath $zipPath -Force
Write-Host "[OK] Created ZIP package" -ForegroundColor Green

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host " DEPLOYMENT PACKAGE READY!" -ForegroundColor Green  
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "`nFolder: $((Resolve-Path $deploymentFolder).Path)" -ForegroundColor White
Write-Host "ZIP: $((Resolve-Path $zipPath).Path)" -ForegroundColor White
Write-Host "`nFiles included:" -ForegroundColor Yellow
Get-ChildItem $deploymentFolder | ForEach-Object {
    Write-Host "  * $($_.Name)" -ForegroundColor White
}
Write-Host "`nReady to distribute to other computers!`n" -ForegroundColor Cyan
