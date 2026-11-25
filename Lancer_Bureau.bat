@echo off
title Gestion de Stock
cd /d "%~dp0"

:: Verifie si le serveur ecoute deja sur le port 3000
powershell -NoProfile -Command "try { $c = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000); $c.Close(); exit 0 } catch { exit 1 }"
if %errorlevel% neq 0 (
  echo Demarrage du serveur Gestion de Stock...
  start "Serveur Gestion de Stock" /min cmd /c "npm run dev"
  timeout /t 4 /nobreak >nul
)

:: Ouvre l'application en fenetre autonome (sans barre de recherche ni onglets)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
  exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
  exit /b
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000
  exit /b
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
  start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000
  exit /b
)

start http://localhost:3000
