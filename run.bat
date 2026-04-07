@echo off
setlocal

set PORT=3000
set URL=http://127.0.0.1:%PORT%
set MIN_NODE=16

echo === Claude Manager ===
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 goto :install_node

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_VER=%%a
for /f "tokens=2 delims=v." %%a in ('node -v') do set NODE_VER=%%a
if %NODE_VER% lss %MIN_NODE% (
    echo Node.js v%MIN_NODE%+ required. Please update: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do echo Node.js %%v found
goto :check_port

:install_node
echo Node.js not found. Attempting to install...
echo.

where winget >nul 2>&1
if %errorlevel% equ 0 (
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    goto :verify_node
)

where choco >nul 2>&1
if %errorlevel% equ 0 (
    choco install nodejs-lts -y
    goto :verify_node
)

echo Could not detect a package manager ^(winget or chocolatey^).
echo Install Node.js manually: https://nodejs.org
pause
exit /b 1

:verify_node
:: Refresh PATH to pick up newly installed node
set "PATH=%ProgramFiles%\nodejs;%APPDATA%\npm;%PATH%"
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js installation failed. Install manually: https://nodejs.org
    echo You may need to restart your terminal after installation.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo Node.js %%v installed
goto :check_port

:check_port
:: Kill existing instance on the same port
for /f "tokens=5" %%p in ('netstat -aon ^| findstr "127.0.0.1:%PORT% " ^| findstr "LISTENING"') do (
    echo Port %PORT% in use ^(PID %%p^), stopping previous instance...
    taskkill /PID %%p /F >nul 2>&1
    timeout /t 1 /nobreak >nul
)

:check_deps
if exist "node_modules" (
    echo Dependencies already installed
) else (
    echo Installing dependencies...
    call npm install
)

echo.
echo Starting Claude Manager at %URL%
echo Press Ctrl+C to stop
echo.

:: Open browser after short delay
start "" cmd /c "timeout /t 2 /nobreak >nul && start %URL%"

call npm start
