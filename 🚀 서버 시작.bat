@echo off
chcp 65001 > nul
title 인원현황표 서버

echo.
echo  =============================================
echo    인원현황표 서버 시작 중...
echo  =============================================
echo.

:: 현재 폴더로 이동
cd /d "%~dp0"

:: 이미 실행 중인 서버가 있으면 종료
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3002" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo  ✅ 서버를 시작합니다...
echo.
echo  ============================================
echo    브라우저에서 아래 주소로 접속하세요!
echo    http://localhost:3002
echo  ============================================
echo.
echo  [이 창을 닫으면 서버가 종료됩니다]
echo.

:: 서버 실행
set "ENVARG="
if exist .env set "ENVARG=--env-file=.env"
node_portable\node.exe %ENVARG% server.js

pause
