@echo off
setlocal EnableExtensions
title CAMS Launcher
cd /d "%~dp0"

rem ==================================================================
rem  CAMS - Classroom Attention Monitoring System (Windows launcher)
rem
rem  Double-click this file. On every run it will:
rem    1. create .venv if missing
rem    2. install Python packages when requirements.txt changed
rem    3. install Node packages if Page\server\node_modules is missing
rem    4. start the web server and open http://localhost:3000
rem    5. start the camera tracking (press Esc in its window to stop)
rem
rem  Extra arguments are passed to Integration.py, e.g.
rem    start.bat C:\path\to\video.mp4
rem    start.bat 1              (use camera index 1)
rem    start.bat --no-display   (no camera window)
rem ==================================================================

set "VENV=%~dp0.venv"
set "VENV_PY=%VENV%\Scripts\python.exe"
set "STAMP=%VENV%\requirements.installed.txt"
set "PORT=3000"
set "SERVER_TITLE=CAMS Web Server"

echo ==================================================
echo  Classroom Attention Monitoring System
echo ==================================================

rem ---- Node.js ------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 goto :no_node
where npm >nul 2>&1
if errorlevel 1 goto :no_node

rem ---- Virtual environment ------------------------------------------
if exist "%VENV_PY%" goto :have_venv

echo [1/4] Creating virtual environment in .venv ...
set "PY="
py -3.11 -c "import sys" >nul 2>&1 && set "PY=py -3.11"
if not defined PY py -3.12 -c "import sys" >nul 2>&1 && set "PY=py -3.12"
if not defined PY py -3.10 -c "import sys" >nul 2>&1 && set "PY=py -3.10"
if not defined PY python -c "import sys" >nul 2>&1 && set "PY=python"
if not defined PY goto :no_python

%PY% -m venv "%VENV%"
if errorlevel 1 goto :venv_failed
if not exist "%VENV_PY%" goto :venv_failed
goto :install_python

:have_venv
echo [1/4] Virtual environment found.

rem ---- Python dependencies (only when requirements.txt changed) -----
:install_python
fc /b "%~dp0requirements.txt" "%STAMP%" >nul 2>&1
if not errorlevel 1 (
    echo [2/4] Python packages up to date.
    goto :install_node
)
echo [2/4] Installing Python packages ^(first run can take a few minutes^) ...
"%VENV_PY%" -m pip install --upgrade pip
"%VENV_PY%" -m pip install -r "%~dp0requirements.txt"
if errorlevel 1 goto :pip_failed
copy /y "%~dp0requirements.txt" "%STAMP%" >nul

rem ---- Node dependencies --------------------------------------------
:install_node
if exist "%~dp0Page\server\node_modules\express" (
    echo [3/4] Node packages up to date.
    goto :start_app
)
echo [3/4] Installing Node packages ...
pushd "%~dp0Page\server"
call npm install
set "NPM_RC=%errorlevel%"
popd
if not "%NPM_RC%"=="0" goto :npm_failed

rem ---- Start web server + camera -------------------------------------
:start_app
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [4/4] Port %PORT% is already in use - assuming the CAMS server is already running.
    goto :open_browser
)
echo [4/4] Starting web server on port %PORT% ...
start "%SERVER_TITLE%" /min cmd /c "cd /d "%~dp0Page\server" && node server.js"

:open_browser

rem give the server a moment, then open the dashboard
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%"

echo.
echo Dashboard: http://localhost:%PORT%
echo Starting camera tracking - press Esc in the camera window to stop.
echo.
"%VENV_PY%" "%~dp0Integration.py" %*
set "APP_RC=%errorlevel%"

echo.
echo Stopping web server ...
taskkill /f /t /fi "WINDOWTITLE eq %SERVER_TITLE%*" >nul 2>&1

if not "%APP_RC%"=="0" (
    echo Camera tracking exited with error code %APP_RC%.
    pause
)
exit /b %APP_RC%

rem ---- Error handlers ------------------------------------------------
:no_node
echo.
echo ERROR: Node.js was not found. Install the LTS version from
echo        https://nodejs.org  ^(tick "Add to PATH"^), then run this again.
pause
exit /b 1

:no_python
echo.
echo ERROR: Python was not found. Install Python 3.11 from
echo        https://www.python.org/downloads/  ^(tick "Add python.exe to PATH"^),
echo        then run this again.
pause
exit /b 1

:venv_failed
echo.
echo ERROR: Could not create the virtual environment.
if exist "%VENV%" rmdir /s /q "%VENV%"
pause
exit /b 1

:pip_failed
echo.
echo ERROR: Installing Python packages failed. Check your internet connection
echo        and that you are using Python 3.10 - 3.12 ^(mediapipe requirement^).
pause
exit /b 1

:npm_failed
echo.
echo ERROR: "npm install" failed. Check your internet connection and retry.
pause
exit /b 1
