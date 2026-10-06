@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the Windows LTS version from https://nodejs.org/
  echo After installing, close this window and double-click this script again.
  pause
  exit /b 1
)
if not exist "realesrgan-ncnn-vulkan-v0.2.0-windows\models\realesrgan-x4plus.bin" (
  echo Model files are missing. Extract the entire project ZIP before starting.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:3000 in your browser.
echo Keep this window open while using the upscaler.
node server.js
pause
