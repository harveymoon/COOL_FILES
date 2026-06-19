@echo off
rem Launches the standalone (production) Cool Files build.
rem Pin this .bat to the taskbar / Start for a one-click launcher.
rem Path is resolved relative to this file, so moving the project folder is fine.
start "" "%~dp0src-tauri\target\release\cool_files.exe"
