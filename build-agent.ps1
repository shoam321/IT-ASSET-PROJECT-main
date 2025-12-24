# Build and Deploy IT Asset Agent
# This script builds the Tauri agent for production deployment

Write-Host "🚀 Building IT Asset Agent..." -ForegroundColor Cyan

# Navigate to agent directory
$agentPath = Join-Path $PSScriptRoot "itam-saas\TauriAgent"
Set-Location $agentPath

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "🔨 Building production bundle..." -ForegroundColor Yellow
npm run tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📂 Installer location:" -ForegroundColor Cyan
$installerPath = Join-Path $agentPath "src-tauri\target\release\bundle\msi"
Write-Host $installerPath -ForegroundColor White
Write-Host ""

# List built files
if (Test-Path $installerPath) {
    Write-Host "📦 Built files:" -ForegroundColor Cyan
    Get-ChildItem $installerPath -Filter "*.msi" | ForEach-Object {
        Write-Host "  - $($_.Name) ($([math]::Round($_.Length / 1MB, 2)) MB)" -ForegroundColor White
    }
} else {
    Write-Host "⚠️  Installer directory not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Agent ready for deployment!" -ForegroundColor Green
