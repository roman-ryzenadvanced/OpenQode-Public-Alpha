@echo off
setlocal EnableDelayedExpansion
title OpenQode v1.01 - AI Coding Assistant
color 0A
cd /d "%~dp0"

echo.
echo ========================================
echo   OpenQode v1.01 - AI Coding Assistant
echo ========================================
echo.

:: Quick Node.js check
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please run Install.bat first or install Node.js from https://nodejs.org/
    start https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js detected

:: Install dependencies if needed (root level)
if not exist "node_modules" (
    echo [INFO] First run - Installing dependencies...
    call npm install --legacy-peer-deps 2>nul || call npm install
)

:: Install dependencies in goose-ultra-final if needed
if not exist "bin\goose-ultra-final\node_modules" (
    echo [INFO] Installing Goose Ultra dependencies...
    pushd "%~dp0bin\goose-ultra-final"
    call npm install --legacy-peer-deps 2>nul || call npm install
    popd
)
echo [OK] Dependencies ready

:MENU
cls
echo.
echo ========================================
echo   OPENQODE v1.01 - LAUNCH MENU
echo ========================================
echo.
echo   RECOMMENDED:
echo   [1] *** GOOSE ULTRA *** (Full IDE Experience)
echo   [2] GOOSE ULTRA DEV (Live Reload Mode)
echo.
echo   TERMINAL INTERFACES:
echo   [3] Next-Gen TUI (Gen 5 - Ink)
echo   [4] TUI Classic (Gen 4 - Node.js)
echo.
echo   TOOLS:
echo   [5] Qwen Authentication (Login/Refresh)
echo   [8] Smart Repair (Fix TUI crashes)
echo   [9] Check Updates
echo.
echo   [0] Exit
echo.
set /p choice="Enter choice (0-9): "

if "%choice%"=="1" goto GOOSE
if "%choice%"=="2" goto GOOSEDEV
if "%choice%"=="3" goto INKTUI
if "%choice%"=="4" goto CLASSICTUI
if "%choice%"=="5" goto QWENAUTH
if "%choice%"=="8" goto REPAIR
if "%choice%"=="9" goto UPDATE
if "%choice%"=="0" goto EXIT
echo Invalid choice.
timeout /t 1 /nobreak >nul
goto MENU

:GOOSE
echo.
echo ========================================
echo   GOOSE ULTRA - Production Mode
echo ========================================
echo.
echo Building Goose Ultra...
pushd "%~dp0bin\goose-ultra-final"

call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Attempting recovery...
    call npm install --legacy-peer-deps
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Build still failing. Please check errors above.
        popd
        pause
        goto MENU
    )
)

echo.
echo Starting Goose Ultra...
start "" npx electron .
popd

echo.
echo Goose Ultra launched! Check for the window.
timeout /t 3 /nobreak >nul
goto MENU

:GOOSEDEV
echo.
echo ========================================
echo   GOOSE ULTRA DEV MODE
echo ========================================
echo.
echo Starting Vite dev server + Electron...
pushd "%~dp0bin\goose-ultra-final"
start "" cmd /c "npm run dev"
echo Waiting for Vite to start...
timeout /t 5 /nobreak >nul
start "" cmd /c "set GOOSE_DEV=true && npx electron ."
popd
echo.
echo Dev mode started! Edits will hot-reload.
timeout /t 2 /nobreak >nul
goto MENU

:INKTUI
echo.
echo Starting Next-Gen TUI (Gen 5)...
node "%~dp0bin\auth-check.mjs" --quiet 2>nul
node --experimental-require-module "%~dp0bin\opencode-ink.mjs"
pause
goto MENU

:CLASSICTUI
echo.
echo Starting TUI Classic (Gen 4)...
node "%~dp0bin\opencode-tui.cjs"
pause
goto MENU

:QWENAUTH
echo.
echo ========================================
echo   QWEN AUTHENTICATION
echo ========================================
echo.
echo Starting Qwen authentication flow...
echo.
node "%~dp0bin\auth.js"
if %errorlevel% equ 0 (
    echo.
    echo [OK] Authentication complete!
) else (
    echo.
    echo [INFO] Authentication may have been cancelled or failed.
    echo        You can try again or use the TUI's /auth command.
)
pause
goto MENU

:REPAIR
echo.
echo Running Smart Repair...
node bin\smart-repair.mjs
pause
goto MENU

:UPDATE
echo.
echo Checking for updates...
git pull 2>nul
if %errorlevel% equ 0 (
    echo [OK] Repository updated!
    echo Please restart the launcher.
) else (
    echo [INFO] Git not available or not a git repository.
    echo Visit https://github.com/your-repo for manual updates.
)
pause
goto MENU

:EXIT
echo.
echo Goodbye!
exit /b 0
