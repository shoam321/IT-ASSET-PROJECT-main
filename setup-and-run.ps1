# IT Asset Tracker - Setup and Run Script
# Run this script after installing Node.js from https://nodejs.org/

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IT Asset Tracker - Setup & Run" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js is installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please download and install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "After installation, restart this terminal and run this script again." -ForegroundColor Yellow
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "✓ npm is installed: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ npm is not installed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installing Dependencies..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Install backend dependencies
Write-Host "Installing Backend dependencies..." -ForegroundColor Yellow
Set-Location ".\itam-saas\Agent"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Backend dependency installation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Backend dependencies installed successfully" -ForegroundColor Green
Write-Host ""

# Install frontend dependencies
Write-Host "Installing Frontend dependencies..." -ForegroundColor Yellow
Set-Location "..\Client"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Frontend dependency installation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Frontend dependencies installed successfully" -ForegroundColor Green
Write-Host ""

# Return to root directory
Set-Location "..\..\"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Servers..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend will run on: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend will run on: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the servers" -ForegroundColor Yellow
Write-Host ""

# Start backend server in background
Write-Host "Starting Backend server..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location "c:\Users\shoam\Downloads\IT-ASSET-PROJECT-main\IT-ASSET-PROJECT-main\itam-saas\Agent"
    npm start
}

# Wait a moment for backend to initialize
Start-Sleep -Seconds 3
Write-Host "✓ Backend server started" -ForegroundColor Green
Write-Host ""

# Start frontend server
Write-Host "Starting Frontend server..." -ForegroundColor Yellow
Set-Location ".\itam-saas\Client"
npm start

# Cleanup - this runs when Ctrl+C is pressed
Write-Host ""
Write-Host "Stopping servers..." -ForegroundColor Yellow
Stop-Job $backendJob
Remove-Job $backendJob
Write-Host "Servers stopped." -ForegroundColor Green
