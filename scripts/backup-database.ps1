# ==============================================================================
# Al-Alamiya ERP/POS — Automated Windows Database Backup Script
# معرض العالمية للمفروشات (Al-Alamiya Home Textiles Showroom)
# ==============================================================================

param (
    [string]$DbName = "elalamya_production",
    [string]$DbUser = "root",
    [string]$DbPassword = "",
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 3306,
    [string]$MysqlBinPath = "C:\xampp\mysql\bin",
    [string]$BackupDir = "E:\elalamya-backups", # Outside the Shop PC drive (e.g. External Drive E: or synced folder)
    [string]$ConfigFile = "", # Optional my.cnf / defaults-extra-file path
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$DumpFileName = $DbName + "_backup_" + $Timestamp + ".sql"

# Ensure backup directory exists
if (-not (Test-Path -Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "[INFO] Created backup directory: $BackupDir"
}

$DumpFilePath = Join-Path -Path $BackupDir -ChildPath $DumpFileName
$MysqldumpExe = Join-Path -Path $MysqlBinPath -ChildPath "mysqldump.exe"

if (-not (Test-Path -Path $MysqldumpExe)) {
    Write-Error "mysqldump.exe not found at: $MysqldumpExe"
    exit 1
}

Write-Host "Starting Database Backup for: $DbName"
Write-Host "Target File: $DumpFilePath"

# Secure Credentials Handling via --defaults-extra-file
# Never expose password in process command-line
$tempCnf = $null
$effectiveCnf = $ConfigFile

if ([string]::IsNullOrWhiteSpace($effectiveCnf)) {
    $tempCnf = [System.IO.Path]::GetTempFileName()
    $cnfContent = @"
[client]
host=$DbHost
port=$DbPort
user=$DbUser
password=$DbPassword
default-character-set=utf8mb4
"@
    Set-Content -Path $tempCnf -Value $cnfContent -Encoding Ascii
    $effectiveCnf = $tempCnf
}

try {
    $cmd = "& `"$MysqldumpExe`" --defaults-extra-file=`"$effectiveCnf`" --single-transaction --quick --routines --triggers --result-file=`"$DumpFilePath`" $DbName"
    Invoke-Expression $cmd

    if ($LASTEXITCODE -ne 0) {
        Write-Error "mysqldump failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }

    # Verify output file
    if (-not (Test-Path -Path $DumpFilePath)) {
        Write-Error "Backup file was not created: $DumpFilePath"
        exit 1
    }

    $fileItem = Get-Item -Path $DumpFilePath
    if ($fileItem.Length -le 0) {
        Write-Error "Backup file is empty (0 bytes): $DumpFilePath"
        exit 1
    }

    $sizeKb = [math]::Round($fileItem.Length / 1024, 2)
    Write-Host "[SUCCESS] Backup created successfully: $DumpFilePath (Size: $sizeKb KB)"

    # Retention cleanup
    $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
    $filterStr = $DbName + "_backup_*.sql"
    $oldFiles = Get-ChildItem -Path $BackupDir -Filter $filterStr | Where-Object { $_.LastWriteTime -lt $cutoffDate }

    foreach ($oldFile in $oldFiles) {
        Remove-Item -Path $oldFile.FullName -Force
        Write-Host "[CLEANUP] Removed old backup past retention: $($oldFile.Name)"
    }

    Write-Host "[COMPLETE] Backup finished successfully."
} finally {
    if ($tempCnf -and (Test-Path -Path $tempCnf)) {
        Remove-Item -Path $tempCnf -Force
    }
}

exit 0
