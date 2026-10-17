@echo off
REM Starts Northstar locally: the backend (port 8000) and the frontend (port 8443)
REM in their own windows, then opens the app in your browser.
REM Double-click this file, or run start.bat from a terminal in this folder.
REM To stop: close the two windows that open.

cd /d "%~dp0"

if not exist venv\Scripts\python.exe (
  echo Setting up Python for the first time...
  python -m venv venv
  venv\Scripts\pip install -r requirements.txt
)
if not exist frontend\node_modules (
  echo Installing the frontend for the first time...
  pushd frontend
  call npm.cmd install
  popd
)

start "Northstar backend" cmd /k "venv\Scripts\python.exe server.py"
start "Northstar frontend" cmd /k "cd frontend && npm.cmd run dev"

echo Waiting for the app to start...
timeout /t 6 /nobreak >nul
start http://localhost:8443
