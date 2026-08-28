@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting Administrator Privileges...
    powershell -Command "Start-Process '%~dpnx0' -Verb RunAs"
    exit /b
)

set SERVICE_NAME=noVNC
set NSSM_PATH=%~dp0nssm.exe

echo Stopping %SERVICE_NAME%...
"%NSSM_PATH%" stop %SERVICE_NAME%

echo Removing %SERVICE_NAME%...
"%NSSM_PATH%" remove %SERVICE_NAME% confirm

echo Done.
pause
