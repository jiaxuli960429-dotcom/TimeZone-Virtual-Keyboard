# Build a single Windows .exe under dist\ (for GitHub Release).
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

Write-Host "Running PyInstaller (onefile)..."
python -m PyInstaller --noconfirm key_server.spec

$exePath = Join-Path $root "dist\TimeZoneKeyboard.exe"
if (-not (Test-Path -LiteralPath $exePath)) {
    throw "Expected output missing: $exePath"
}

Write-Host ""
Write-Host "Done: $exePath"
Write-Host "GitHub Release should attach this file (see .github/workflows/release-windows.yml)."
