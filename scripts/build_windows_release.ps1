# Build Windows folder + zip for GitHub Release (or local test).
# Local:  powershell -ExecutionPolicy Bypass -File scripts\build_windows_release.ps1
# CI sets $env:CI=true and installs deps before calling this script.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not $env:CI) {
    Write-Host "Installing dependencies..."
    python -m pip install -U pip
    python -m pip install -r requirements.txt pyinstaller
}

Write-Host "Running PyInstaller..."
python -m PyInstaller --noconfirm key_server.spec

$distDir = Join-Path $root "dist\TimeZoneKeyboard"
$docListFile = Join-Path $root "scripts\release_bundle_docs.txt"
Get-Content -LiteralPath $docListFile -Encoding utf8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
        return
    }
    $src = Join-Path $root $line
    if (Test-Path -LiteralPath $src) {
        Copy-Item -LiteralPath $src -Destination $distDir -Force
    } else {
        Write-Warning "Doc not found, skip: $line"
    }
}

$starter = Join-Path $distDir "start-keyboard.bat"
@"
@echo off
chcp 65001 >nul
title DOTA Keyboard Display
cd /d "%~dp0"

echo ========================================
echo    DOTA Keyboard Display (免 Python)
echo ========================================
echo.

if not exist "TimeZoneKeyboard.exe" (
    echo [ERROR] 未找到 TimeZoneKeyboard.exe
    pause
    exit /b 1
)

echo [1/2] 正在启动键盘服务与网页服务...
start "Keyboard + HTTP" "%~dp0TimeZoneKeyboard.exe"

timeout /t 2 /nobreak >nul
echo      服务已启动 - WebSocket 8765, HTTP 8080
echo.

echo [2/2] 正在打开浏览器...
start "" "http://localhost:8080"

echo.
echo ========================================
echo    已启动
echo ========================================
echo.
echo 详细步骤见本文件夹内 使用说明.md / USER_GUIDE.txt
echo 方案保存在本文件夹下的 configs\ 目录。
echo.
echo 按任意键关闭本窗口（程序仍在后台运行）
pause >nul
"@ | Set-Content -Encoding utf8 $starter

$zipPath = Join-Path $root "dist\TimeZoneKeyboard-Windows.zip"
if (Test-Path $zipPath) {
    Remove-Item -Force $zipPath
}
Compress-Archive -Path $distDir -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "Done: $distDir"
Write-Host "Zip (upload to GitHub Release): $zipPath"
