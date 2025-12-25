# Quick Fix Script for Forbidden Apps
# This script will help you redeploy to Vercel with the correct environment variable

Write-Host "🔧 Forbidden Apps Fix - Deployment Helper" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "1. Install Vercel CLI: npm install -g vercel"
    Write-Host "2. Or manually add environment variable in Vercel Dashboard:"
    Write-Host "   - Go to: https://vercel.com/dashboard"
    Write-Host "   - Select your project"
    Write-Host "   - Go to Settings → Environment Variables"
    Write-Host "   - Add: REACT_APP_API_URL = https://it-asset-project-production.up.railway.app"
    Write-Host "   - Redeploy from Deployments tab"
    Write-Host ""
    exit
}

Write-Host "✅ Vercel CLI is installed" -ForegroundColor Green
Write-Host ""

# Show what will be done
Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "1. Navigate to the Client directory" -ForegroundColor White
Write-Host "2. Add environment variable to Vercel project" -ForegroundColor White
Write-Host "3. Trigger a new deployment" -ForegroundColor White
Write-Host ""

# Confirm
$confirm = Read-Host "Do you want to continue? (y/n)"
if ($confirm -ne "y") {
    Write-Host "❌ Cancelled" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "🚀 Starting deployment process..." -ForegroundColor Cyan
Write-Host ""

# Navigate to Client directory
$clientPath = "itam-saas\Client"
if (-not (Test-Path $clientPath)) {
    Write-Host "❌ Client directory not found at: $clientPath" -ForegroundColor Red
    exit
}

Set-Location $clientPath

# Add environment variable
Write-Host "📝 Adding environment variable to Vercel..." -ForegroundColor Yellow
vercel env add REACT_APP_API_URL production

# Trigger deployment
Write-Host ""
Write-Host "🚀 Deploying to Vercel..." -ForegroundColor Yellow
vercel --prod

Write-Host ""
Write-Host "✅ Deployment initiated!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Wait for deployment to complete (check Vercel dashboard)"
Write-Host "2. Visit your app: https://it-asset-project.vercel.app"
Write-Host "3. Login with: admin / admin123"
Write-Host "4. Navigate to Forbidden Apps section"
Write-Host "5. You should see 7 default forbidden apps!"
Write-Host ""
Write-Host "If you still see errors, check FORBIDDEN_APPS_FIX.md for manual steps." -ForegroundColor Yellow
