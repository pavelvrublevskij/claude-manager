@echo off
setlocal enabledelayedexpansion

:: Claude Manager — unified run script
::
:: Usage:
::   run.bat           Show interactive menu
::   run.bat <number>  Run option directly (e.g., run.bat 1)

set PORT=3000
set URL=http://127.0.0.1:%PORT%
set DOCKER_URL=http://localhost:%PORT%
set MIN_NODE=16
set COMPOSE_FILE=%~dp0docker-compose.yml
set DOCKER_SERVICE=app

:: Header
echo.
echo ======================================
echo        Claude Manager
echo ======================================
echo.

:: Check for direct argument
if not "%~1"=="" (
    set CHOICE=%~1
    goto :run_choice
)

:: Menu
echo   Local (Node.js)
echo   1)  Start            Install deps, start server, open browser
echo.
echo   Docker
echo   2)  Build ^& Start    Build image and start container
echo   3)  Start            Start existing container
echo   4)  Stop             Stop and remove container
echo   5)  Restart          Restart container
echo   6)  Rebuild          Full rebuild (no cache)
echo   7)  Logs             Follow container logs
echo   8)  Status           Show container status
echo   9)  Shell            Open shell in container
echo.
echo   0)  Exit
echo.
set /p CHOICE="  Select option: "
echo.

:run_choice
if "%CHOICE%"=="1" goto :do_local_start
if "%CHOICE%"=="2" goto :do_docker_build_start
if "%CHOICE%"=="3" goto :do_docker_start
if "%CHOICE%"=="4" goto :do_docker_stop
if "%CHOICE%"=="5" goto :do_docker_restart
if "%CHOICE%"=="6" goto :do_docker_rebuild
if "%CHOICE%"=="7" goto :do_docker_logs
if "%CHOICE%"=="8" goto :do_docker_status
if "%CHOICE%"=="9" goto :do_docker_shell
if "%CHOICE%"=="0" goto :do_exit
echo Invalid option: %CHOICE%
goto :eof

:: ─── Local (Node.js) ───────────────────────────────────────────────

:do_local_start
echo [Local Start]
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. Install from https://nodejs.org
    echo.
    goto :eof
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_VER=%%a
if %NODE_VER% lss %MIN_NODE% (
    echo Node.js v%MIN_NODE%+ required. Please update: https://nodejs.org
    goto :eof
)
for /f "tokens=*" %%v in ('node -v') do echo   Node.js %%v found

:: Kill existing instance on the same port
for /f "tokens=5" %%p in ('netstat -aon ^| findstr "127.0.0.1:%PORT% " ^| findstr "LISTENING"') do (
    echo   Port %PORT% in use ^(PID %%p^), stopping previous instance...
    taskkill /PID %%p /F >nul 2>&1
    timeout /t 1 /nobreak >nul
)

:: Install dependencies
if exist "node_modules" (
    echo   Dependencies installed
) else (
    echo   Installing dependencies...
    call npm install
)

echo.
echo   Starting server...

:: Start server as hidden background process
powershell -command "Start-Process node -ArgumentList 'server.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

:: Wait for server
call :wait_for_server_local
if %errorlevel% equ 0 start "" %URL%

echo.
echo   Claude Manager is running at %URL%
echo   To stop: close port %PORT% from Task Manager
echo.
goto :eof

:: ─── Docker actions ────────────────────────────────────────────────

:do_docker_build_start
call :check_docker
if %errorlevel% neq 0 goto :eof
echo [Docker Build ^& Start]
echo.
echo   This will mount the following directory with read-write access:
echo     ~/.claude — Claude Code configuration, sessions, and memory
echo.
echo   Read-write access is required to manage sessions, memory, backups, and other configuration.
echo.
set /p CONFIRM="  Continue? [y/N]: "
if /i not "%CONFIRM%"=="y" (
    echo.
    echo   Aborted.
    echo.
    goto :eof
)
echo.
echo   Building image and starting container...
docker compose -f "%COMPOSE_FILE%" up --build -d
echo.
call :wait_for_server_docker
if %errorlevel% equ 0 start "" %DOCKER_URL%
echo.
echo   Claude Manager is running at %DOCKER_URL%
echo.
goto :eof

:do_docker_start
call :check_docker
if %errorlevel% neq 0 goto :eof
echo [Docker Start]
echo.
docker compose -f "%COMPOSE_FILE%" ps --status running 2>nul | findstr /c:"claude-manager" >nul 2>&1
if %errorlevel% equ 0 (
    echo   Container is already running.
    echo.
    goto :eof
)
echo   Starting container...
docker compose -f "%COMPOSE_FILE%" up -d
echo.
call :wait_for_server_docker
if %errorlevel% equ 0 start "" %DOCKER_URL%
echo.
echo   Claude Manager is running at %DOCKER_URL%
echo.
goto :eof

:do_docker_stop
call :check_docker
if %errorlevel% neq 0 goto :eof
echo [Docker Stop]
echo.
echo   Stopping container...
docker compose -f "%COMPOSE_FILE%" down
echo.
echo   Container stopped.
echo.
goto :eof

:do_docker_restart
call :check_docker
if %errorlevel% neq 0 goto :eof
echo [Docker Restart]
echo.
docker compose -f "%COMPOSE_FILE%" ps --status running 2>nul | findstr /c:"claude-manager" >nul 2>&1
if %errorlevel% neq 0 (
    echo   Container is not running. Use option 2 or 3 to start.
    echo.
    goto :eof
)
echo   Restarting container...
docker compose -f "%COMPOSE_FILE%" restart
echo.
call :wait_for_server_docker
echo.
echo   Container restarted.
echo.
goto :eof

:do_docker_rebuild
call :check_docker
if %errorlevel% neq 0 goto :eof
echo [Docker Rebuild - no cache]
echo.
echo   This will mount the following directory with read-write access:
echo     ~/.claude — Claude Code configuration, sessions, and memory
echo.
echo   Read-write access is required to manage sessions, memory, backups, and other configuration.
echo.
set /p CONFIRM="  Continue? [y/N]: "
if /i not "%CONFIRM%"=="y" (
    echo.
    echo   Aborted.
    echo.
    goto :eof
)
echo.
echo   Rebuilding image from scratch...
docker compose -f "%COMPOSE_FILE%" build --no-cache
echo   Starting container...
docker compose -f "%COMPOSE_FILE%" up -d
echo.
call :wait_for_server_docker
if %errorlevel% equ 0 start "" %DOCKER_URL%
echo.
echo   Claude Manager rebuilt and running at %DOCKER_URL%
echo.
goto :eof

:do_docker_logs
call :check_docker
if %errorlevel% neq 0 goto :eof
echo [Docker Logs] (Ctrl+C to exit)
echo.
docker compose -f "%COMPOSE_FILE%" ps --status running 2>nul | findstr /c:"claude-manager" >nul 2>&1
if %errorlevel% neq 0 (
    echo   Container is not running.
    echo.
    goto :eof
)
docker compose -f "%COMPOSE_FILE%" logs -f
goto :eof

:do_docker_status
call :check_docker
if %errorlevel% neq 0 goto :eof
echo [Docker Status]
echo.
docker compose -f "%COMPOSE_FILE%" ps -a
echo.
docker compose -f "%COMPOSE_FILE%" ps --status running 2>nul | findstr /c:"claude-manager" >nul 2>&1
if %errorlevel% equ 0 (
    echo   Running at %DOCKER_URL%
) else (
    echo   Not running
)
echo.
goto :eof

:do_docker_shell
call :check_docker
if %errorlevel% neq 0 goto :eof
echo [Docker Shell]
echo.
docker compose -f "%COMPOSE_FILE%" ps --status running 2>nul | findstr /c:"claude-manager" >nul 2>&1
if %errorlevel% neq 0 (
    echo   Container is not running. Use option 2 or 3 to start.
    echo.
    goto :eof
)
docker compose -f "%COMPOSE_FILE%" exec %DOCKER_SERVICE% sh
goto :eof

:do_exit
echo Bye!
goto :eof

:: ─── Helpers ────────────────────────────────────────────────────────

:check_docker
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo   Docker is not installed. Install: https://docs.docker.com/get-docker/
    exit /b 1
)
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo   Docker daemon is not running. Start Docker Desktop.
    exit /b 1
)
exit /b 0

:wait_for_server_local
set /a ATTEMPTS=0
:wait_loop_local
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 30 (
    echo   Server did not start within 30 seconds.
    exit /b 1
)
powershell -command "try { $null = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto :wait_loop_local
)
exit /b 0

:wait_for_server_docker
set /a ATTEMPTS=0
:wait_loop_docker
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 30 (
    echo   Server did not start within 30 seconds.
    echo   Run "run.bat 7" to check logs.
    exit /b 1
)
powershell -command "try { $null = Invoke-WebRequest -Uri '%DOCKER_URL%' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto :wait_loop_docker
)
exit /b 0
