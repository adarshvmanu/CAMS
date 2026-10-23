@echo off
setlocal EnableExtensions
title CAMS Launcher
cd /d "%~dp0"

rem ==================================================================
rem  CAMS - Classroom Attention Monitoring System (Windows launcher)
rem
rem  Double-click this file. On every run it will:
rem    1. create .venv if missing (offers to install Python 3.11 if none found)
rem    2. install Python packages when requirements.txt changed
rem    3. install Node packages if Page\server\node_modules is missing
rem       (offers to download a portable Node.js into .node if none found)
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
set "NODE_VER=24.22.1"
set "NODE_SHA256=d2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5"
set "ROOT=%~dp0"
set "NODE_DIR=%ROOT%.node\node-v%NODE_VER%-win-x64"

where node >nul 2>&1
if errorlevel 1 goto :node_missing
where npm >nul 2>&1
if errorlevel 1 goto :node_missing
goto :node_ready

:node_missing
rem Portable copy installed by an earlier run?
if not exist "%NODE_DIR%\node.exe" call :install_node_runtime
if not exist "%NODE_DIR%\node.exe" goto :no_node
set "PATH=%NODE_DIR%;%PATH%"

:node_ready

rem ---- Virtual environment ------------------------------------------
rem mediapipe 0.10.14 only ships wheels for Python 3.10 - 3.12
set "PYCHECK=import sys; sys.exit(0 if sys.version_info[:2] in [(3,10),(3,11),(3,12)] else 1)"

if not exist "%VENV_PY%" goto :create_venv
"%VENV_PY%" -c "%PYCHECK%" >nul 2>&1
if not errorlevel 1 goto :have_venv
echo [1/4] Existing .venv uses an unsupported Python version - recreating it ...
rmdir /s /q "%VENV%"

:create_venv
echo [1/4] Creating virtual environment in .venv ...
set "PY="
py -3.11 -c "%PYCHECK%" >nul 2>&1 && set "PY=py -3.11"
if not defined PY py -3.12 -c "%PYCHECK%" >nul 2>&1 && set "PY=py -3.12"
if not defined PY py -3.10 -c "%PYCHECK%" >nul 2>&1 && set "PY=py -3.10"
if not defined PY python -c "%PYCHECK%" >nul 2>&1 && set "PY=python"
if not defined PY call :install_python_runtime
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
rem Remove any OpenCV builds first: they all share one cv2 folder and break
rem each other when more than one is installed.
"%VENV_PY%" -m pip uninstall -y opencv-python opencv-python-headless opencv-contrib-python opencv-contrib-python-headless >nul 2>&1
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
start "%SERVER_TITLE%" /min cmd /k "cd /d "%~dp0Page\server" && node server.js"

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

if not "%APP_RC%"=="0" (
    echo.
    echo Camera tracking exited with error code %APP_RC% - see the messages above.
    echo The web server is still running. Press any key to stop it and close.
    pause >nul
)

echo.
echo Stopping web server ...
taskkill /f /t /fi "WINDOWTITLE eq %SERVER_TITLE%*" >nul 2>&1
exit /b %APP_RC%

rem ---- Error handlers ------------------------------------------------
:no_node
echo.
echo ERROR: Node.js could not be set up automatically. Install the LTS version
echo        from https://nodejs.org  ^(tick "Add to PATH"^), then run this again.
pause
exit /b 1

:no_python
echo.
echo ERROR: Python 3.10 - 3.12 is required but could not be set up automatically.
echo        Install Python 3.11 from https://www.python.org/downloads/
echo        ^(tick "Add python.exe to PATH"^), then run this again.
pause
exit /b 1

rem ---- Subroutine: install portable Node.js into .node ----------------
rem Uses the official zip (no admin rights, no PATH changes). On success
rem %NODE_DIR%\node.exe exists; otherwise it is left missing.
:install_node_runtime
set "NODE_ZIP=%TEMP%\node-v%NODE_VER%-win-x64.zip"
set "NODE_URL=https://nodejs.org/dist/v%NODE_VER%/node-v%NODE_VER%-win-x64.zip"

echo.
echo Node.js was not found on this computer.
choice /c YN /m "Download Node.js %NODE_VER% into the project's .node folder now"
if errorlevel 2 exit /b 1

echo Downloading %NODE_URL% ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%'"
if errorlevel 1 (
    echo Download failed.
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "if ((Get-FileHash -Algorithm SHA256 '%NODE_ZIP%').Hash -ne '%NODE_SHA256%') { exit 1 }"
if errorlevel 1 (
    echo The downloaded file failed its SHA-256 check - aborting.
    del /q "%NODE_ZIP%" >nul 2>&1
    exit /b 1
)

echo Extracting Node.js ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Force -LiteralPath '%NODE_ZIP%' -DestinationPath '%ROOT%.node'"
del /q "%NODE_ZIP%" >nul 2>&1
exit /b 0

rem ---- Subroutine: install Python 3.11 for the current user -----------
rem Sets PY on success, leaves it undefined if declined or failed.
:install_python_runtime
set "PY_VER=3.11.9"
set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
set "PY_INSTALLER=%TEMP%\python-%PY_VER%-amd64.exe"
set "PY_URL=https://www.python.org/ftp/python/%PY_VER%/python-%PY_VER%-amd64.exe"

rem Installed by an earlier run but not on PATH in this session?
if exist "%PY_EXE%" (
    set PY="%PY_EXE%"
    exit /b 0
)

echo.
echo No compatible Python ^(3.10 - 3.12^) was found on this computer.
choice /c YN /m "Download and install Python %PY_VER% for your user account now"
if errorlevel 2 exit /b 1

echo Downloading %PY_URL% ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%PY_URL%' -OutFile '%PY_INSTALLER%'"
if errorlevel 1 (
    echo Download failed.
    exit /b 1
)

rem Only run the installer if it is signed by the Python Software Foundation
powershell -NoProfile -ExecutionPolicy Bypass -Command "if ((Get-AuthenticodeSignature '%PY_INSTALLER%').SignerCertificate.Subject -notmatch 'Python Software Foundation') { exit 1 }"
if errorlevel 1 (
    echo The downloaded installer is not signed by the Python Software Foundation - aborting.
    del /q "%PY_INSTALLER%" >nul 2>&1
    exit /b 1
)

echo Installing Python %PY_VER% ^(this takes a minute^) ...
start /wait "" "%PY_INSTALLER%" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0 Include_launcher=0 Shortcuts=0
del /q "%PY_INSTALLER%" >nul 2>&1

if exist "%PY_EXE%" (
    set PY="%PY_EXE%"
    exit /b 0
)
echo Python installation did not complete.
exit /b 1

:venv_failed
echo.
echo ERROR: Could not create the virtual environment.
if exist "%VENV%" rmdir /s /q "%VENV%"
pause
exit /b 1

:pip_failed
echo.
echo ERROR: Installing Python packages failed. See the pip output above.
echo        Python used by .venv:
"%VENV_PY%" --version
echo        mediapipe needs Python 3.10 - 3.12. If the version above is
echo        different, delete the .venv folder and run this again.
echo        Otherwise check your internet connection.
pause
exit /b 1

:npm_failed
echo.
echo ERROR: "npm install" failed. Check your internet connection and retry.
pause
exit /b 1
