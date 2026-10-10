# ==============================================================================
# Al-Alamiya ERP/POS — Install Apache VirtualHost Configuration (XAMPP Windows)
# ==============================================================================

param(
    [string]$XamppPath = "C:\xampp"
)

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Al-Alamiya ERP/POS — Apache Production Setup" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$apacheConfDir = Join-Path $XamppPath "apache\conf"
$apacheExtraDir = Join-Path $apacheConfDir "extra"
$targetConf = Join-Path $apacheExtraDir "al-alamya.conf"
$sourceConf = Join-Path $PSScriptRoot "apache\al-alamya.conf"
$httpdConf = Join-Path $apacheConfDir "httpd.conf"
$httpdExe = Join-Path $XamppPath "apache\bin\httpd.exe"

if (-not (Test-Path $httpdExe)) {
    Write-Error "Apache executable not found at $httpdExe. Please verify XAMPP installation."
    return
}

# 1. Copy config to XAMPP extra directory
Write-Host "[1/4] Copying al-alamya.conf to $apacheExtraDir..." -ForegroundColor Yellow
Copy-Item -Path $sourceConf -Destination $targetConf -Force

# 2. Check and enable rewrite_module in httpd.conf
Write-Host "[2/4] Verifying mod_rewrite in httpd.conf..." -ForegroundColor Yellow
$httpdContent = Get-Content $httpdConf -Raw
if ($httpdContent -match '#\s*LoadModule rewrite_module modules/mod_rewrite.so') {
    $httpdContent = $httpdContent -replace '#\s*LoadModule rewrite_module modules/mod_rewrite.so', 'LoadModule rewrite_module modules/mod_rewrite.so'
    Set-Content -Path $httpdConf -Value $httpdContent
    Write-Host "  Enabled mod_rewrite." -ForegroundColor Green
} else {
    Write-Host "  mod_rewrite is already enabled." -ForegroundColor Green
}

# 3. Include al-alamya.conf if not already included
Write-Host "[3/4] Ensuring al-alamya.conf is included in httpd.conf..." -ForegroundColor Yellow
$includeLine = "Include conf/extra/al-alamya.conf"
if (-not ($httpdContent -match [regex]::Escape($includeLine))) {
    Add-Content -Path $httpdConf -Value "`n# Al-Alamiya ERP VirtualHost`n$includeLine`n"
    Write-Host "  Added '$includeLine' to httpd.conf." -ForegroundColor Green
} else {
    Write-Host "  '$includeLine' is already present." -ForegroundColor Green
}

# 4. Test configuration syntax
Write-Host "[4/4] Testing Apache syntax..." -ForegroundColor Yellow
& $httpdExe -t
Write-Host "`n✓ Apache installation check complete." -ForegroundColor Green
