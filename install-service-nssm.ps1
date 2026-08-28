# Self-elevation check
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Elevating permissions to Administrator..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    Exit
}

$ServiceName = "noVNC"
$BaseDir     = $PSScriptRoot.TrimEnd('\')
$Nssm        = Join-Path $BaseDir "nssm.exe"
$Python      = "C:\Program Files\Python314\python.exe"
$Script      = Join-Path $BaseDir "run_novnc.py"
$LogDir      = Join-Path $BaseDir "logs"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }

Write-Host "Configuring TightVNC settings (No idle disconnect, swap on new connection)..." -ForegroundColor Cyan
Set-ItemProperty -Path "HKLM:\SOFTWARE\TightVNC\Server" -Name "IdleTimeout" -Value 0 -Type DWord -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKLM:\SOFTWARE\TightVNC\Server" -Name "DisconnectClients" -Value 1 -Type DWord -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKLM:\SOFTWARE\TightVNC\Server" -Name "BlockClients" -Value 0 -Type DWord -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKLM:\SOFTWARE\TightVNC\Server" -Name "NeverShared" -Value 0 -Type DWord -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKLM:\SOFTWARE\TightVNC\Server" -Name "AlwaysShared" -Value 0 -Type DWord -ErrorAction SilentlyContinue

if (Test-Path "C:\Program Files\TightVNC\tvnserver.exe") {
    & "C:\Program Files\TightVNC\tvnserver.exe" -controlservice -reload 2>$null | Out-Null
}

Write-Host "Installing $ServiceName using NSSM..." -ForegroundColor Cyan

# Stop and remove existing service if present
& $Nssm stop $ServiceName 2>$null | Out-Null
& $Nssm remove $ServiceName confirm 2>$null | Out-Null

# Install new service
& $Nssm install $ServiceName $Python "`"$Script`""
& $Nssm set $ServiceName AppDirectory "$BaseDir"
& $Nssm set $ServiceName Description "noVNC WebSockets Bridge for VNC on port 6080"
& $Nssm set $ServiceName Start SERVICE_AUTO_START
& $Nssm set $ServiceName AppStdout "$LogDir\novnc_service.log"
& $Nssm set $ServiceName AppStderr "$LogDir\novnc_service_error.log"
& $Nssm set $ServiceName AppRestartDelay 3000

Write-Host "Starting $ServiceName service..." -ForegroundColor Green
& $Nssm start $ServiceName

Write-Host "`nService $ServiceName is now RUNNING and configured to never disconnect on idle!" -ForegroundColor Green
Write-Host "Web URL: http://localhost:6080/" -ForegroundColor Yellow
Start-Sleep -Seconds 4
