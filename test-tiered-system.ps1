# Test Tiered User System
# This script creates test users and demonstrates data isolation

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  IT Asset Management - User Tier Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$API_URL = "https://it-asset-project-production.up.railway.app/api"

# Check if running locally or production
if (Test-Path "itam-saas/Agent/server.js") {
    $response = Read-Host "Run against (1) Production or (2) Local server? [1/2]"
    if ($response -eq "2") {
        $API_URL = "http://localhost:5000/api"
        Write-Host "⚠️  Using LOCAL server: $API_URL" -ForegroundColor Yellow
        Write-Host "   Make sure server is running: npm start" -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host "📡 Testing against: $API_URL" -ForegroundColor Green
Write-Host ""

# Step 1: Run migration
Write-Host "Step 1: Running user-asset-ownership migration..." -ForegroundColor Yellow
try {
    Set-Location "itam-saas/Agent"
    node migrations/run-user-asset-ownership-migration.js
    Set-Location "../.."
    Write-Host "✅ Migration completed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Migration may have already run: $_" -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Create admin user (if not exists)
Write-Host "Step 2: Creating admin user..." -ForegroundColor Yellow
try {
    Set-Location "itam-saas/Agent"
    node create-admin.js
    Set-Location "../.."
    Write-Host "✅ Admin user ready" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Admin may already exist: $_" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Login as admin
Write-Host "Step 3: Testing admin login..." -ForegroundColor Yellow
$adminCreds = @{
    username = "admin"
    password = "admin123"  # Change if you set different password
} | ConvertTo-Json

try {
    $adminLogin = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method POST -Body $adminCreds -ContentType "application/json"
    $adminToken = $adminLogin.token
    Write-Host "✅ Admin logged in successfully" -ForegroundColor Green
    Write-Host "   Token: $($adminToken.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Admin login failed: $_" -ForegroundColor Red
    Write-Host "   Make sure admin password is correct" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 4: Create test users
Write-Host "Step 4: Creating test users (Alice and Bob)..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

# Create Alice
$aliceData = @{
    username = "alice"
    email = "alice@company.com"
    password = "alice123"
    full_name = "Alice Johnson"
    role = "user"
} | ConvertTo-Json

try {
    $alice = Invoke-RestMethod -Uri "$API_URL/auth/register" -Method POST -Body $aliceData -Headers $headers
    Write-Host "✅ Created user: alice (ID: $($alice.user.id))" -ForegroundColor Green
    $aliceId = $alice.user.id
} catch {
    Write-Host "⚠️  Alice may already exist" -ForegroundColor Yellow
    # Get Alice's ID by logging in
    $aliceLogin = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method POST -Body (@{username="alice"; password="alice123"} | ConvertTo-Json) -ContentType "application/json"
    $aliceId = $aliceLogin.userId
}

# Create Bob
$bobData = @{
    username = "bob"
    email = "bob@company.com"
    password = "bob123"
    full_name = "Bob Smith"
    role = "user"
} | ConvertTo-Json

try {
    $bob = Invoke-RestMethod -Uri "$API_URL/auth/register" -Method POST -Body $bobData -Headers $headers
    Write-Host "✅ Created user: bob (ID: $($bob.user.id))" -ForegroundColor Green
    $bobId = $bob.user.id
} catch {
    Write-Host "⚠️  Bob may already exist" -ForegroundColor Yellow
    $bobLogin = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method POST -Body (@{username="bob"; password="bob123"} | ConvertTo-Json) -ContentType "application/json"
    $bobId = $bobLogin.userId
}
Write-Host ""

# Step 5: Login as Alice and Bob
Write-Host "Step 5: Testing user logins..." -ForegroundColor Yellow

$aliceLoginResult = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method POST -Body (@{username="alice"; password="alice123"} | ConvertTo-Json) -ContentType "application/json"
$aliceToken = $aliceLoginResult.token
Write-Host "✅ Alice logged in" -ForegroundColor Green

$bobLoginResult = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method POST -Body (@{username="bob"; password="bob123"} | ConvertTo-Json) -ContentType "application/json"
$bobToken = $bobLoginResult.token
Write-Host "✅ Bob logged in" -ForegroundColor Green
Write-Host ""

# Step 6: Create assets for each user (as admin)
Write-Host "Step 6: Creating test assets..." -ForegroundColor Yellow

$aliceAsset = @{
    asset_tag = "LAPTOP-ALICE-001"
    asset_type = "Laptop"
    manufacturer = "Dell"
    model = "XPS 15"
    user_id = $aliceId
    status = "In Use"
} | ConvertTo-Json

$aliceAssetResult = Invoke-RestMethod -Uri "$API_URL/assets" -Method POST -Body $aliceAsset -Headers $headers
Write-Host "✅ Created asset for Alice: $($aliceAssetResult.asset_tag)" -ForegroundColor Green

$bobAsset = @{
    asset_tag = "LAPTOP-BOB-001"
    asset_type = "Laptop"
    manufacturer = "HP"
    model = "EliteBook 840"
    user_id = $bobId
    status = "In Use"
} | ConvertTo-Json

$bobAssetResult = Invoke-RestMethod -Uri "$API_URL/assets" -Method POST -Body $bobAsset -Headers $headers
Write-Host "✅ Created asset for Bob: $($bobAssetResult.asset_tag)" -ForegroundColor Green
Write-Host ""

# Step 7: Test data isolation
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing Data Isolation (RLS)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Alice views her assets
Write-Host "Test 1: Alice viewing her assets..." -ForegroundColor Yellow
$aliceHeaders = @{
    "Authorization" = "Bearer $aliceToken"
}
$aliceAssets = Invoke-RestMethod -Uri "$API_URL/assets" -Method GET -Headers $aliceHeaders
Write-Host "   Alice sees $($aliceAssets.Count) asset(s)" -ForegroundColor Cyan
foreach ($asset in $aliceAssets) {
    Write-Host "   - $($asset.asset_tag) ($($asset.manufacturer) $($asset.model))" -ForegroundColor Gray
}
Write-Host ""

# Bob views his assets
Write-Host "Test 2: Bob viewing his assets..." -ForegroundColor Yellow
$bobHeaders = @{
    "Authorization" = "Bearer $bobToken"
}
$bobAssets = Invoke-RestMethod -Uri "$API_URL/assets" -Method GET -Headers $bobHeaders
Write-Host "   Bob sees $($bobAssets.Count) asset(s)" -ForegroundColor Cyan
foreach ($asset in $bobAssets) {
    Write-Host "   - $($asset.asset_tag) ($($asset.manufacturer) $($asset.model))" -ForegroundColor Gray
}
Write-Host ""

# Admin views all assets
Write-Host "Test 3: Admin viewing all assets..." -ForegroundColor Yellow
$adminAssets = Invoke-RestMethod -Uri "$API_URL/assets" -Method GET -Headers $headers
Write-Host "   Admin sees $($adminAssets.Count) asset(s)" -ForegroundColor Cyan
foreach ($asset in $adminAssets) {
    Write-Host "   - $($asset.asset_tag) ($($asset.manufacturer) $($asset.model)) - User: $($asset.user_id)" -ForegroundColor Gray
}
Write-Host ""

# Verify isolation
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verification Results" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$aliceOnlySeesHers = ($aliceAssets | Where-Object { $_.asset_tag -eq "LAPTOP-ALICE-001" }).Count -eq 1 -and 
                     ($aliceAssets | Where-Object { $_.asset_tag -eq "LAPTOP-BOB-001" }).Count -eq 0

$bobOnlySeesHis = ($bobAssets | Where-Object { $_.asset_tag -eq "LAPTOP-BOB-001" }).Count -eq 1 -and 
                  ($bobAssets | Where-Object { $_.asset_tag -eq "LAPTOP-ALICE-001" }).Count -eq 0

$adminSeesAll = ($adminAssets | Where-Object { $_.asset_tag -eq "LAPTOP-ALICE-001" }).Count -eq 1 -and 
                ($adminAssets | Where-Object { $_.asset_tag -eq "LAPTOP-BOB-001" }).Count -eq 1

if ($aliceOnlySeesHers) {
    Write-Host "✅ Alice can only see her own assets (ISOLATED)" -ForegroundColor Green
} else {
    Write-Host "❌ Alice sees other users' assets (ISOLATION FAILED)" -ForegroundColor Red
}

if ($bobOnlySeesHis) {
    Write-Host "✅ Bob can only see his own assets (ISOLATED)" -ForegroundColor Green
} else {
    Write-Host "❌ Bob sees other users' assets (ISOLATION FAILED)" -ForegroundColor Red
}

if ($adminSeesAll) {
    Write-Host "✅ Admin can see all users' assets (FULL ACCESS)" -ForegroundColor Green
} else {
    Write-Host "❌ Admin doesn't see all assets (ADMIN ACCESS FAILED)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Test the Tauri Agent:" -ForegroundColor Yellow
Write-Host "   - Login as 'alice' with password 'alice123'" -ForegroundColor Gray
Write-Host "   - Agent will collect device data tagged with Alice's user_id" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test the Web Frontend:" -ForegroundColor Yellow
Write-Host "   - Login as 'alice' at the web interface" -ForegroundColor Gray
Write-Host "   - Verify you see only Alice's devices and assets" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Verify Synchronization:" -ForegroundColor Yellow
Write-Host "   - Check that device data from agent appears in web dashboard" -ForegroundColor Gray
Write-Host "   - Hostname should match the PC where agent is running" -ForegroundColor Gray
Write-Host ""
Write-Host "Test Credentials:" -ForegroundColor Cyan
Write-Host "  Admin:  username=admin,  password=admin123" -ForegroundColor Gray
Write-Host "  Alice:  username=alice,  password=alice123" -ForegroundColor Gray
Write-Host "  Bob:    username=bob,    password=bob123" -ForegroundColor Gray
Write-Host ""
