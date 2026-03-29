@echo off
chcp 65001 >nul
title TimeZoneKeyboard

cd /d "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.8 或更高版本。
    echo 下载: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

python key_server.py

echo.
echo 服务已退出。按任意键关闭本窗口。
pause >nul
