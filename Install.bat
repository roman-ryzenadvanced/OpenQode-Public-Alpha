@echo off
setlocal EnableDelayedExpansion
title OpenQode v1.01 - Installation Wizard
color 0B
cd /d "%~dp0"

echo.
echo ========================================================
echo   OpenQode v1.01 - AUTOMATED INSTALLATION WIZARD
echo ========================================================
echo.
echo   This installer will set up everything you need:
echo   - Node.js (if not installed)
echo   - All dependencies
echo   - Goose Ultra IDE
echo.
echo   Press any key to start installation...
pause >nul
echo.

:: ========================================================
:: ADMIN CHECK
:: ========================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Not running as Administrator. Some features may be limited.
    echo        For best results, right-click and "Run as Administrator"
    echo.
)

:: ========================================================
:: NODE.JS CHECK AND INSTALL
:: ========================================================
echo [STEP 1/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Node.js not found. Attempting automatic installation...
    
    :: Try winget first (Windows 11 / Windows 10 with App Installer)
    winget --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo [INFO] Installing Node.js via winget...
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        if %errorlevel% equ 0 (
            echo [OK] Node.js installed via winget!
            echo [INFO] Please restart this installer after Node.js is in your PATH.
            pause
            exit /b 0
        )
    )
    
    :: Try chocolatey
    choco --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo [INFO] Installing Node.js via Chocolatey...
        choco install nodejs-lts -y
        if %errorlevel% equ 0 (
            echo [OK] Node.js installed via Chocolatey!
            refreshenv
            goto NODE_OK
        )
    )
    
    :: Manual install fallback
    echo.
    echo ========================================================
    echo   MANUAL INSTALLATION REQUIRED
    echo ========================================================
    echo.
    echo   Node.js could not be installed automatically.
    echo   Please install it manually:
    echo.
    echo   1. Go to: https://nodejs.org/
    echo   2. Download the LTS version (recommended)
    echo   3. Run the installer (use all default options)
    echo   4. RESTART your computer
    echo   5. Run this installer again
    echo.
    start https://nodejs.org/
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
    echo [OK] Node.js !NODE_VER! detected
)
:NODE_OK

:: ========================================================
:: NPM UPDATE CHECK
:: ========================================================
echo [STEP 2/5] Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found! This shouldn't happen if Node.js is installed.
    echo         Please reinstall Node.js from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm --version') do set NPM_VER=%%v
echo [OK] npm %NPM_VER% detected

:: ========================================================
:: GIT CHECK (optional)
:: ========================================================
echo [STEP 3/5] Checking Git (optional)...
git --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=3" %%v in ('git --version') do set GIT_VER=%%v
    echo [OK] Git !GIT_VER! detected (updates enabled)
) else (
    echo [INFO] Git not found (optional - updates disabled)
)

:: ========================================================
:: ROOT DEPENDENCIES
:: ========================================================
echo [STEP 4/5] Installing root dependencies...
if exist "node_modules" (
    echo [OK] Root dependencies already installed
) else (
    echo [INFO] Running npm install...
    call npm install --legacy-peer-deps 2>nul || call npm install
    if %errorlevel% neq 0 (
        echo [WARNING] Some packages may have issues. Attempting alternative install...
        call npm install --force
    )
    echo [OK] Root dependencies installed
)

:: ========================================================
:: GOOSE ULTRA DEPENDENCIES
:: ========================================================
echo [STEP 5/5] Installing Goose Ultra IDE dependencies...
if exist "bin\goose-ultra-final\node_modules" (
    echo [OK] Goose Ultra dependencies already installed
) else (
    pushd "%~dp0bin\goose-ultra-final"
    echo [INFO] Running npm install in Goose Ultra...
    call npm install --legacy-peer-deps 2>nul || call npm install
    if %errorlevel% neq 0 (
        echo [WARNING] Some packages may have issues. Attempting alternative install...
        call npm install --force
    )
    
    :: Pre-build to catch any issues early
    echo [INFO] Pre-building Goose Ultra...
    call npm run build 2>nul
    popd
    echo [OK] Goose Ultra dependencies installed
)

:: ========================================================
:: VERIFICATION
:: ========================================================
echo.
echo ========================================================
echo   INSTALLATION COMPLETE
echo ========================================================
echo.
echo   Checking installation...

set ERRORS=0

node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] Node.js
) else (
    echo   [FAIL] Node.js
    set /a ERRORS+=1
)

npm --version >nul 2>&1
if %errorlevel% equ 0 (
    echo   [OK] npm
) else (
    echo   [FAIL] npm
    set /a ERRORS+=1
)

if exist "node_modules" (
    echo   [OK] Root dependencies
) else (
    echo   [FAIL] Root dependencies
    set /a ERRORS+=1
)

if exist "bin\goose-ultra-final\node_modules" (
    echo   [OK] Goose Ultra dependencies
) else (
    echo   [FAIL] Goose Ultra dependencies
    set /a ERRORS+=1
)

echo.
if %ERRORS% equ 0 (
    echo   ===========================================
    echo   ALL CHECKS PASSED! Ready to launch.
    echo   ===========================================
    echo.
    echo   Run OpenQode.bat to start the application!
    echo.
) else (
    echo   ===========================================
    echo   SOME CHECKS FAILED (%ERRORS% errors)
    echo   ===========================================
    echo.
    echo   Try running this installer again.
    echo   If problems persist, please report the issue.
    echo.
)

pause
exit /b %ERRORS%
