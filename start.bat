@echo off
echo ========================================
echo    GKApp - Iniciando servidor local
echo ========================================
echo.
echo Abriendo navegador con http://localhost:5173
echo.

start "" http://localhost:5173

cd /d "%~dp0gkapp-web"
npm run dev
