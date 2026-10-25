@echo off
setlocal EnableExtensions
title CAMS Studio Launcher
cd /d "%~dp0"

rem ==================================================================
rem  CAMS — Classroom Attention Monitoring System (Windows Launcher)
rem  Lightweight, unified Python engine (no Node.js required)
rem ==================================================================

set "VENV=%~dp0.venv"
set "VENV_PY=%VENV%\Scripts\python.exe"
set "STAMP=%VENV%\requirements.installed.txt"
set "PORT=3000"

echo ==================================================
echo   CAMS Studio — Classroom Attention Monitoring
echo ==================================================

rem ---- Virtual environment (Python 3.10 - 3.12 required for MediaPipe) ----
set "PYCHECK=import sys; sys.exit(0 if sys.version_info[:2] in [(3,10),(3,11),(3,12)] else 1)"

if not exist "%VENV_PY%" goto :create_venv
"%VENV_PY%" -c "%PYCHECK%" >nul 2>&1
if not errorlevel 1 goto :have_venv
echo [1/3] Existing .venv uses an unsupported Python version - recreating it ...
rmdir /s /q "%VENV%"

:create_venv
echo [1/3] Detecting Python 3.10-3.12 ...
set "PY="
py -3.12 -c "%PYCHECK%" >nul 2>&1 && set "PY=py -3.12"
if not defined PY py -3.11 -c "%PYCHECK%" >nul 2>&1 && set "PY=py -3.11"
if not defined PY py -3.10 -c "%PYCHECK%" >nul 2>&1 && set "PY=py -3.10"
if not defined PY python -c "%PYCHECK%" >nul 2>&1 && set "PY=python"

if not defined PY (
    echo Error: Python 3.10, 3.11, or 3.12 was not found.
    echo Please install Python 3.11 from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/3] Creating virtual environment in .venv ...
%PY% -m venv "%VENV%"
if errorlevel 1 (
    echo Error: Failed to create virtual environment.
    pause
    exit /b 1
)

:have_venv
echo [1/3] Python virtual environment ready.

rem ---- Python dependencies ----
:install_python
fc /b "%~dp0requirements.txt" "%STAMP%" >nul 2>&1
if not errorlevel 1 (
    echo [2/3] Python dependencies up to date.
    goto :start_server
)
echo [2/3] Installing Python dependencies from requirements.txt ...
"%VENV_PY%" -m pip install --upgrade pip
"%VENV_PY%" -m pip install -r "%~dp0requirements.txt"
if errorlevel 1 (
    echo Error: Failed to install Python dependencies.
    pause
    exit /b 1
)
copy /y "%~dp0requirements.txt" "%STAMP%" >nul

rem ---- Launch Unified CAMS Engine ----
:start_server
echo [3/3] Starting Unified CAMS Studio engine on http://localhost:%PORT% ...
start "" "http://localhost:%PORT%"
"%VENV_PY%" server.py %*
if errorlevel 1 pause
