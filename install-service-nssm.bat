@echo off
setlocal EnableDelayedExpansion

:: Self-elevation check
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator Privileges...
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

set "SERVICE_NAME=noVNC"
set "BASE_DIR=%~dp0"
:: Strip trailing backslash from BASE_DIR if present
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"

set "NSSM_PATH=%BASE_DIR%\nssm.exe"
set "PYTHON_PATH=C:\Program Files\Python314\python.exe"
set "SCRIPT_PATH=%BASE_DIR%\run_novnc.py"
set "LOG_DIR=%BASE_DIR%\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo =======================================================
echo  Configuring TightVNC Persistent Connection Settings
echo =======================================================
:: Set IdleTimeout to 0 (Never disconnect on inactivity)
reg add "HKLM\SOFTWARE\TightVNC\Server" /v "IdleTimeout" /t REG_DWORD /d 0 /f >nul 2>&1
:: Disconnect old client when a new non-shared connection arrives
reg add "HKLM\SOFTWARE\TightVNC\Server" /v "DisconnectClients" /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v "BlockClients" /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v "NeverShared" /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKLM\SOFTWARE\TightVNC\Server" /v "AlwaysShared" /t REG_DWORD /d 0 /f >nul 2>&1

:: Reload TightVNC settings
if exist "C:\Program Files\TightVNC\tvnserver.exe" (
    "C:\Program Files\TightVNC\tvnserver.exe" -controlservice -reload >nul 2>&1
)

echo =======================================================
echo  Installing noVNC Windows Service using NSSM
echo =======================================================

echo Stopping and removing old service if present...
"%NSSM_PATH%" stop %SERVICE_NAME% >nul 2>&1
"%NSSM_PATH%" remove %SERVICE_NAME% confirm >nul 2>&1

echo Installing %SERVICE_NAME% service...
"%NSSM_PATH%" install %SERVICE_NAME% "%PYTHON_PATH%" "%SCRIPT_PATH%"
"%NSSM_PATH%" set %SERVICE_NAME% AppDirectory "%BASE_DIR%"
"%NSSM_PATH%" set %SERVICE_NAME% Description "noVNC WebSockets Bridge for VNC on port 6080"
"%NSSM_PATH%" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%NSSM_PATH%" set %SERVICE_NAME% AppStdout "%LOG_DIR%\novnc_service.log"
"%NSSM_PATH%" set %SERVICE_NAME% AppStderr "%LOG_DIR%\novnc_service_error.log"
"%NSSM_PATH%" set %SERVICE_NAME% AppRestartDelay 3000

echo Starting %SERVICE_NAME% service...
"%NSSM_PATH%" start %SERVICE_NAME%

echo.
echo =======================================================
echo  noVNC Service Successfully Started!
echo  - Status: Always Running (Auto-Start on Boot)
echo  - Persistent: Never disconnects on idle
echo  - Connection Handover: Disconnects old session when new connection arrives
echo  - Web Access: http://localhost:6080/
echo =======================================================
timeout /t 5
