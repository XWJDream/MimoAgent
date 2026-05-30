@echo off
setlocal
cd /d "%~dp0"
if exist "release\win-unpacked\MimoAgent.exe" (
  start "" "release\win-unpacked\MimoAgent.exe"
) else (
  echo release\win-unpacked\MimoAgent.exe not found.
  echo Run package-win.cmd or npm run package:dir first.
  pause
)
