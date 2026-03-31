@echo off
setlocal

REM One-click local agent test runner
REM Usage:
REM   start-agent-test.bat
REM   start-agent-test.bat ws://8.140.239.22/ws/realtime demo my-device

set "CFG_FILE=%~dp0agent-test.env"
set "SERVER_WS_URL=%~1"
set "CHANNEL=%~2"
set "DEVICE_ID=%~3"

REM Load defaults from config file if present.
if exist "%CFG_FILE%" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%CFG_FILE%") do (
    if /I "%%A"=="SERVER_WS_URL" if "%SERVER_WS_URL%"=="" set "SERVER_WS_URL=%%B"
    if /I "%%A"=="CHANNEL" if "%CHANNEL%"=="" set "CHANNEL=%%B"
    if /I "%%A"=="DEVICE_ID" if "%DEVICE_ID%"=="" set "DEVICE_ID=%%B"
  )
)

if "%SERVER_WS_URL%"=="" set "SERVER_WS_URL=ws://8.140.239.22/ws/realtime"
if "%CHANNEL%"=="" set "CHANNEL=demo"
if "%DEVICE_ID%"=="" set "DEVICE_ID=dev-local"

set "AGENT_DIR=%~dp0local_agent"
if not exist "%AGENT_DIR%\agent_main.py" (
  echo [ERROR] local_agent\agent_main.py not found
  exit /b 1
)

cd /d "%AGENT_DIR%"

if not exist ".venv\Scripts\python.exe" (
  echo [INFO] Creating virtual environment...
  python -m venv .venv
  if errorlevel 1 (
    echo [ERROR] Failed to create venv. Please install Python first.
    exit /b 1
  )
)

echo [INFO] Installing/updating dependencies...
call ".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] Failed to install dependencies.
  exit /b 1
)

set "TZK_SERVER_WS_URL=%SERVER_WS_URL%"
set "TZK_CHANNEL=%CHANNEL%"
set "TZK_DEVICE_ID=%DEVICE_ID%"
set "TZK_LOG_STATS_INTERVAL_SEC=2"
set "PYTHONUNBUFFERED=1"

echo [INFO] Launching with:
echo        TZK_SERVER_WS_URL=%TZK_SERVER_WS_URL%
echo        TZK_CHANNEL=%TZK_CHANNEL%
echo        TZK_DEVICE_ID=%TZK_DEVICE_ID%
echo        TZK_LOG_STATS_INTERVAL_SEC=%TZK_LOG_STATS_INTERVAL_SEC%
echo.
echo [INFO] Starting agent. Press Ctrl+C to stop.
call ".venv\Scripts\python.exe" agent_main.py

endlocal
