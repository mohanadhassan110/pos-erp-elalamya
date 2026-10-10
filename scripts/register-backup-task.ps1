# ==============================================================================
# Al-Alamiya ERP/POS — Register Backup Task in Windows Task Scheduler
# ==============================================================================

param(
    [string]$TaskName = "AlAlamiya_Daily_Backup",
    [string]$BackupDir = "D:\elalamya-backups",
    [string]$Time = "23:30"
)

$scriptPath = "d:\elalamya-main\scripts\backup-database.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`" -DbName elalamya_production -BackupDir `"$BackupDir`""
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Daily automated database backup for Al-Alamiya ERP/POS" -Force

Write-Host "[SUCCESS] Task '$TaskName' registered successfully in Windows Task Scheduler."
