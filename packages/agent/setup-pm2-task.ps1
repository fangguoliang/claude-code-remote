# PM2 Agent Auto-Start Setup Script
$TaskName = "PM2-RemoteCli-Agent"
$BatPath = "C:\Users\Administrator\.pm2\pm2-start.bat"

# Delete existing task if exists
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Create action
$Action = New-ScheduledTaskAction -Execute $BatPath -WorkingDirectory "C:\Users\Administrator\.pm2"

# Create trigger - AtLogon for Administrator user
$Trigger = New-ScheduledTaskTrigger -AtLogon -User "Administrator"

# Create settings
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit 0

# Create principal
$Principal = New-ScheduledTaskPrincipal -UserId "Administrator" -LogonType Interactive -RunLevel Highest

# Register task
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "PM2 agents auto-start at login"

Write-Host "Task '$TaskName' created successfully!"
Write-Host "Trigger: AtLogon for Administrator"
Write-Host "Action: $BatPath"