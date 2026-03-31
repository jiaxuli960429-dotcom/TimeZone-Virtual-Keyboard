@echo off
setlocal

set "BACKEND_DIR=%~dp0cloud_backend"
if not exist "%BACKEND_DIR%\app\main.py" (
  echo [ERROR] cloud_backend\app\main.py not found
  exit /b 1
)

cd /d "%BACKEND_DIR%"

if not exist ".venv\Scripts\python.exe" (
  echo [INFO] Creating cloud backend venv...
  python -m venv .venv
  if errorlevel 1 (
    echo [ERROR] Failed to create venv.
    exit /b 1
  )
)

echo [INFO] Installing cloud backend dependencies...
call ".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] Failed to install dependencies.
  exit /b 1
)

echo [INFO] Starting cloud backend at http://127.0.0.1:8000
call ".venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

endlocal
