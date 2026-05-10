@echo off
title Linguamic TTS Server
color 0A
echo.
echo  ================================================
echo   LINGUAMIC - Starting TTS Tunnel
echo  ================================================
echo.
echo  [1/2] Checking Docker container...
docker start voiceforge-api >nul 2>&1
echo  voiceforge-api container started
echo.
echo  [2/2] Starting ngrok tunnel...
echo  Public URL: https://overcaptious-noelle-malarian.ngrok-free.dev
echo.
echo  Keep this window OPEN while using TTS on linguamic.com
echo  Close this window to stop TTS.
echo  ================================================
echo.
ngrok http 8000 --domain=overcaptious-noelle-malarian.ngrok-free.dev
pause
