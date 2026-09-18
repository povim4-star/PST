@echo off
chcp 65001 > nul
title DB 복원 도구

echo.
echo  =============================================
echo    인원현황표 데이터 복원 도구
echo  =============================================
echo.

cd /d "%~dp0"

:: 가장 최근 백업 파일 찾기
set "LATEST="
for /f "delims=" %%f in ('dir /b /o-d /a-d "backup\database_backup_*.sqlite" 2^>nul') do (
    if not defined LATEST set "LATEST=%%f"
)

if not defined LATEST (
    echo  ❌ backup 폴더에 백업 파일이 없습니다!
    pause
    exit /b 1
)

echo  📁 복원할 백업 파일: %LATEST%
echo.
echo  ⚠️  현재 database.sqlite를 이 백업으로 덮어씁니다.
echo     계속하시겠습니까? (Y/N)
set /p CONFIRM=  입력: 

if /i "%CONFIRM%" neq "Y" (
    echo  취소했습니다.
    pause
    exit /b 0
)

echo.
echo  🔄 복원 중...
copy /y "backup\%LATEST%" "database.sqlite" > nul
echo  ✅ 복원 완료! backup\%LATEST% → database.sqlite
echo.
echo  서버를 재시작하시면 복원된 데이터를 사용합니다.
echo  [🚀 서버 시작.bat] 파일을 더블클릭 하세요!
echo.
pause
