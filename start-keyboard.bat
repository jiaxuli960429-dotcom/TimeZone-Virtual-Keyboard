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

:: WebSocket + HTTP - static page and configs API on port 8080
echo [2/2] Starting keyboard service and local web server...
start "Keyboard + HTTP" pythonw key_server.py

timeout /t 2 /nobreak >nul
echo      Service started - WebSocket 8765, HTTP 8080
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
echo 1. Control panel: http://localhost:8080
echo 2. OBS: copy URL from OBS browser source box - must include /overlay?config=
echo 3. Canvas size: match OBS browser W x H to control panel top bar
echo 4. OBS browser source: enable custom FPS e.g. 60
echo 5. Full guide: 使用说明.md in this folder
echo.
echo Features:
echo - Global keyboard capture: works when browser not focused
echo - Press F2 to show or hide settings
echo - Config profiles in configs folder
echo.
echo Note:
echo - First run may auto-install dependencies - needs internet
echo - If service fails: run python key_server.py in terminal to see errors
echo.
echo Press any key to close this window - services keep running
pause >nul
