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

echo [1/3] Python detected
echo.

:: Start keyboard capture service
echo [2/3] Starting keyboard capture service...
start "Keyboard Capture" pythonw key_server.py

timeout /t 2 /nobreak >nul
echo      Keyboard capture service started
echo.

:: Start HTTP server
echo [3/3] Starting HTTP server...
start "HTTP Server" powershell -WindowStyle Hidden -Command "cd '%~dp0'; $listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:8080/'); $listener.Start(); while ($listener.IsListening) { try { $context = $listener.GetContext(); $request = $context.Request; $response = $context.Response; $path = $request.Url.LocalPath; if ($path -eq '/') { $path = '/index.html' }; $file = Join-Path (Get-Location) $path; if (Test-Path $file) { $content = [System.IO.File]::ReadAllBytes($file); $response.ContentType = if ($path -like '*.html') { 'text/html' } elseif ($path -like '*.js') { 'application/javascript' } elseif ($path -like '*.css') { 'text/css' } elseif ($path -like '*.png') { 'image/png' } elseif ($path -like '*.jpg') { 'image/jpeg' } else { 'application/octet-stream' }; $response.OutputStream.Write($content, 0, $content.Length) } else { $response.StatusCode = 404 }; $response.Close() } catch {} }"

timeout /t 1 /nobreak >nul
echo      HTTP server started
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
echo.
echo Note:
echo - First run will auto-install dependencies (needs internet)
echo - If keyboard service not working, run: python key_server.py
echo.
echo Press any key to close this window (services will continue)
pause >nul
