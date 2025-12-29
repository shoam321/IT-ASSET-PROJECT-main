# Railway Logs Monitor
# Fetches and analyzes Railway logs every 2 minutes

Write-Host "Railway Logs Monitor Started" -ForegroundColor Cyan
Write-Host "Service: IT-ASSET-PROJECT" -ForegroundColor Cyan
Write-Host "Interval: 2 minutes" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow

$checkInterval = 120 # 2 minutes in seconds
$iteration = 0

function Analyze-Logs {
    param([string]$logs)
    
    $analysis = @{
        Errors = 0
        Warnings = 0
        SuccessfulRequests = 0
        FailedRequests = 0
        UniqueUsers = @()
        Issues = @()
        ContainerRestarts = 0
        MindeeErrors = 0
        DatabaseErrors = 0
    }
    
    # Split logs into lines
    $lines = $logs -split "`n"
    
    foreach ($line in $lines) {
        # Count errors
        if ($line -match '\[err\]|ERROR|Error|error:') {
            $analysis.Errors++
            if ($line -notmatch "npm warn" -and $line -notmatch "MemoryStore") {
                $analysis.Issues += $line.Trim()
            }
        }
        
        # Count warnings (excluding known safe warnings)
        if ($line -match '\[warn\]|WARNING|Warning' -and $line -notmatch "MemoryStore" -and $line -notmatch "npm warn") {
            $analysis.Warnings++
            $analysis.Issues += $line.Trim()
        }
        
        # Count successful API requests
        if ($line -match '-> 20[01]') {
            $analysis.SuccessfulRequests++
        }
        
        # Count failed API requests
        if ($line -match '-> [45]\d{2}') {
            $analysis.FailedRequests++
            $analysis.Issues += $line.Trim()
        }
        
        # Extract user IDs
        if ($line -match 'userId=(\d+)') {
            $userId = $matches[1]
            if ($userId -notin $analysis.UniqueUsers) {
                $analysis.UniqueUsers += $userId
            }
        }
        
        # Track container restarts
        if ($line -match 'Stopping Container|Starting Container') {
            $analysis.ContainerRestarts++
            $analysis.Issues += "RESTART: $($line.Trim())"
        }
        
        # Track Mindee errors
        if ($line -match 'Mindee parsing error|Mindee.*error') {
            $analysis.MindeeErrors++
            $analysis.Issues += "MINDEE: $($line.Trim())"
        }
        
        # Track database errors
        if ($line -match 'could not receive data from client|database.*error|Connection reset') {
            $analysis.DatabaseErrors++
        }
        
        # Check for critical issues
        if ($line -match 'SIGTERM|SIGKILL|crashed|fatal|FATAL') {
            $analysis.Issues += "CRITICAL: $($line.Trim())"
        }
    }
    
    return $analysis
}

function Send-WindowsNotification {
    param(
        [string]$title,
        [string]$message,
        [string]$severity = "Warning"
    )
    
    try {
        # Create notification
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        
        $template = @"
<toast>
    <visual>
        <binding template="ToastText02">
            <text id="1">$title</text>
            <text id="2">$message</text>
        </binding>
    </visual>
    <audio src="ms-winsoundevent:Notification.Default"/>
</toast>
"@
        
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Railway Monitor").Show($toast)
    }
    catch {
        # Fallback to system beep
        [Console]::Beep(800, 300)
    }
}

function Display-Analysis {
    param($analysis, $iteration, $timestamp)
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Check #$iteration - $timestamp" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    # Status indicator and notifications
    if ($analysis.Issues.Count -eq 0 -and $analysis.FailedRequests -eq 0) {
        Write-Host "STATUS: HEALTHY" -ForegroundColor Green
    } elseif ($analysis.Issues.Count -lt 3) {
        Write-Host "STATUS: WARNING" -ForegroundColor Yellow
        Send-WindowsNotification -title "Railway Warning" -message "$($analysis.Issues.Count) issue(s) detected on IT-ASSET-PROJECT" -severity "Warning"
        [Console]::Beep(600, 200)
    } else {
        Write-Host "STATUS: CRITICAL" -ForegroundColor Red
        Send-WindowsNotification -title "Railway CRITICAL" -message "$($analysis.Issues.Count) critical issues detected!" -severity "Critical"
        [Console]::Beep(1000, 500)
    }
    
    Write-Host "`nMetrics:" -ForegroundColor White
    Write-Host "  Successful Requests: $($analysis.SuccessfulRequests)" -ForegroundColor Green
    Write-Host "  Failed Requests: $($analysis.FailedRequests)" -ForegroundColor $(if ($analysis.FailedRequests -gt 0) { "Red" } else { "Gray" })
    Write-Host "  Errors: $($analysis.Errors)" -ForegroundColor $(if ($analysis.Errors -gt 0) { "Red" } else { "Gray" })
    Write-Host "  Warnings: $($analysis.Warnings)" -ForegroundColor $(if ($analysis.Warnings -gt 0) { "Yellow" } else { "Gray" })
    Write-Host "  Container Restarts: $($analysis.ContainerRestarts)" -ForegroundColor $(if ($analysis.ContainerRestarts -gt 0) { "Red" } else { "Gray" })
    Write-Host "  Mindee Errors: $($analysis.MindeeErrors)" -ForegroundColor $(if ($analysis.MindeeErrors -gt 0) { "Yellow" } else { "Gray" })
    Write-Host "  Database Errors: $($analysis.DatabaseErrors)" -ForegroundColor $(if ($analysis.DatabaseErrors -gt 0) { "Red" } else { "Gray" })
    Write-Host "  Active Users: $($analysis.UniqueUsers.Count)" -ForegroundColor Cyan
    if ($analysis.UniqueUsers.Count -gt 0) {
        Write-Host "    User IDs: $($analysis.UniqueUsers -join ', ')" -ForegroundColor Gray
    }
    
    # Display issues
    if ($analysis.Issues.Count -gt 0) {
        Write-Host "`nIssues Found:" -ForegroundColor Red
        $analysis.Issues | Select-Object -First 10 | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Yellow
        }
        if ($analysis.Issues.Count -gt 10) {
            Write-Host "  ... and $($analysis.Issues.Count - 10) more" -ForegroundColor Gray
        }
    }
    
    Write-Host "`nNext check in 2 minutes..." -ForegroundColor Gray
}

# Main monitoring loop
while ($true) {
    $iteration++
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    try {
        # Fetch logs
        Write-Host "`n Fetching logs..." -ForegroundColor Gray
        $logs = railway logs --service IT-ASSET-PROJECT --lines 100 2>&1 | Out-String
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to fetch logs (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
            Write-Host $logs -ForegroundColor Red
        } else {
            # Analyze logs
            $analysis = Analyze-Logs -logs $logs
            
            # Display results
            Display-Analysis -analysis $analysis -iteration $iteration -timestamp $timestamp
        }
    }
    catch {
        Write-Host "Error during monitoring: $_" -ForegroundColor Red
    }
    
    # Wait 2 minutes
    Start-Sleep -Seconds $checkInterval
}
