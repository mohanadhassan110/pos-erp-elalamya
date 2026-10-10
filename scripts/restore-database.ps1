# ==============================================================================
# Al-Alamiya ERP/POS — Windows Database Restore Script
# معرض العالمية للمفروشات (Al-Alamiya Home Textiles Showroom)
# ==============================================================================

param (
    [Parameter(Mandatory=$true)]
    [string]$DumpFilePath,

    [string]$DbName = "elalamya_production",
    [string]$DbUser = "root",
    [string]$DbPassword = "",
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 3306,
    [string]$MysqlBinPath = "C:\xampp\mysql\bin",
    [string]$ConfigFile = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -Path $DumpFilePath)) {
    Write-Error "Dump file does not exist: $DumpFilePath"
    exit 1
}

$MysqlExe = Join-Path -Path $MysqlBinPath -ChildPath "mysql.exe"
if (-not (Test-Path -Path $MysqlExe)) {
    Write-Error "mysql.exe not found at: $MysqlExe"
    exit 1
}

Write-Host "Restoring Database: $DbName from $DumpFilePath"

# Secure Credentials Handling via --defaults-extra-file
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
    # Ensure target database exists
    $createSql = "CREATE DATABASE IF NOT EXISTS $DbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    & "$MysqlExe" --defaults-extra-file="$effectiveCnf" -e "$createSql"

    # Execute restore via cmd.exe file redirection
    $restoreCmd = "`"$MysqlExe`" --defaults-extra-file=`"$effectiveCnf`" $DbName < `"$DumpFilePath`""
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$restoreCmd`"" -NoNewWindow -Wait -PassThru

    if ($process.ExitCode -ne 0) {
        Write-Error "Restore process exited with error code: $($process.ExitCode)"
        exit $process.ExitCode
    }

    Write-Host "[SUCCESS] Database $DbName restored successfully."
} finally {
    if ($tempCnf -and (Test-Path -Path $tempCnf)) {
        Remove-Item -Path $tempCnf -Force
    }
}

exit 0
