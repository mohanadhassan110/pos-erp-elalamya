# ==============================================================================
# Al-Alamiya ERP/POS — Windows Firewall Configuration Script
# معرض العالمية للمفروشات — حصر الوصول للشبكة المحلية فقط
# ==============================================================================

[CmdletBinding()]
param(
    [string]$LocalSubnet = "192.168.1.0/24",
    [string]$RuleName = "AlAlamiya_ERP_LAN_Only"
)

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Al-Alamiya ERP/POS — Windows Firewall LAN Setup" -ForegroundColor Cyan
Write-Host " Rule Target Subnet: $LocalSubnet" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Remove existing rule if present
Get-NetFirewallRule -Name $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

# 2. Create inbound rule restricted to local subnet only
try {
    New-NetFirewallRule `
        -Name $RuleName `
        -DisplayName "Al-Alamiya ERP/POS LAN Access (Port 80)" `
        -Description "Restricts inbound ERP access strictly to the showroom local subnet ($LocalSubnet)." `
        -Direction Inbound `
        -LocalPort 80 `
        -Protocol TCP `
        -Action Allow `
        -RemoteAddress $LocalSubnet `
        -Profile Any `
        -Enabled True

    Write-Host "`n✓ Firewall rule successfully created:" -ForegroundColor Green
    Get-NetFirewallRule -Name $RuleName | Format-List Name, DisplayName, Direction, Action, Enabled
} catch {
    Write-Warning "Could not configure Windows Firewall rule (requires Administrator privileges): $_"
    Write-Host "Command to run as Administrator:" -ForegroundColor Yellow
    Write-Host "New-NetFirewallRule -Name '$RuleName' -DisplayName 'Al-Alamiya ERP/POS LAN Access (Port 80)' -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow -RemoteAddress '$LocalSubnet'"
}
