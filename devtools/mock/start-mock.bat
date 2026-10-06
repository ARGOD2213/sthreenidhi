@echo off
rem Optional (needs Node.js). The preview also opens straight from ui-mock\index.html with no install.
cd /d "%~dp0"
start "" http://localhost:8088/
node server.js
pause
