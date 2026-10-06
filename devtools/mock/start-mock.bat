@echo off
rem Starts the mock dashboard (fake data, no database). Needs Node.js 12 or newer: https://nodejs.org
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
start "" http://localhost:8088/sthreenidhi/mock
node server.js
pause
