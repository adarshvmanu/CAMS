@echo off
setlocal
cd /d "%~dp0"

set "PY="
py -3.12 -V >nul 2>&1 && set "PY=py -3.12"
if not defined PY py -3.11 -V >nul 2>&1 && set "PY=py -3.11"
if not defined PY py -3.10 -V >nul 2>&1 && set "PY=py -3.10"
if not defined PY python -V >nul 2>&1 && set "PY=python"

if not defined PY (
    echo Error: Python was not found in PATH.
    echo Please install Python 3.11 from https://www.python.org/downloads/
    pause
    exit /b 1
)

%PY% cams.py %*
if errorlevel 1 pause
