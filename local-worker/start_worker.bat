@echo off
rem Starts the render worker. Put a shortcut to this file in Task Scheduler ("At log on").
cd /d "%~dp0"
call venv\Scripts\activate.bat
:loop
git pull --ff-only
python worker.py
echo Worker stopped, restarting in 5 s...
timeout /t 5 /nobreak >nul
goto loop
