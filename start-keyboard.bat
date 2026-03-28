@echo off
chcp 65001 >nul
title DOTA Keyboard Display

echo ========================================
echo    DOTA Keyboard Display
echo ========================================
echo.
echo Starting...
echo.

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found, please install Python 3.8+
    echo Download: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo [1/2] Python detected
echo.

:: WebSocket + HTTP (static page + configs API on port 8080)
echo [2/2] Starting keyboard service and local web server...
start "Keyboard + HTTP" pythonw key_server.py

timeout /t 2 /nobreak >nul
echo      Service started (WebSocket 8765, HTTP 8080)
echo.

:: Open browser
echo Opening browser...
start "" "http://localhost:8080"

echo.
echo ========================================
echo    Started!
echo ========================================
echo.
echo Usage:
echo 1. In OBS, add Browser source, URL: http://localhost:8080
echo 2. Recommended size: 1200x400
echo 3. Check "Use custom frame rate": 60 FPS
echo.
echo Features:
echo - Global keyboard capture: works even when browser is not focused
echo - Press F2 to show/hide settings
echo - Config profiles saved under configs\ folder in this project
echo.
echo Note:
echo - First run will auto-install dependencies (needs internet)
echo - If keyboard service not working, run: python key_server.py
echo.
echo Press any key to close this window (services will continue)
pause >nul
