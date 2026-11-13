@echo off
rem Starts the EPIC Overview server and opens it in the browser.
rem Phones and tablets on the same Wi-Fi use the address the server prints.
setlocal
cd /d "%~dp0"
title EPIC Overview

if not defined EPIC_PORT set "EPIC_PORT=8765"

rem Find Python 3.9 or newer: "python" first, then the "py" launcher.
set "PYTHON="
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
if not errorlevel 1 set "PYTHON=python"
if not defined PYTHON (
    py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
    if not errorlevel 1 set "PYTHON=py -3"
)
if not defined PYTHON (
    echo Python 3.9 or newer was not found.
    echo Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
    pause
    exit /b 1
)

rem Open the browser one second from now, when the server is listening.
start "" /min cmd /c "timeout /t 1 >nul & start "" http://localhost:%EPIC_PORT%/"

%PYTHON% server.py
if errorlevel 1 pause
