@echo off
setlocal
cd /d "%~dp0"
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm run package:win
pause
