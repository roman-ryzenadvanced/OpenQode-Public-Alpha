@echo off
REM ╔══════════════════════════════════════════════════════════════════╗
REM ║  OpenQode TUI - Full Auto Installer (Windows)                     ║
REM ║  This script installs EVERYTHING needed - just double-click!      ║
REM ╚══════════════════════════════════════════════════════════════════╝

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║       OpenQode TUI - Windows Auto Installer                  ║
echo  ║       This will install all required dependencies            ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

REM Check for Administrator rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] This installer needs Administrator rights for some features.
    echo [!] Right-click and "Run as administrator" for full installation.
    echo [i] Continuing with limited installation...
    echo.
)

REM Step 1: Check for Node.js
echo [1/6] Checking for Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Node.js not found. Installing via winget...
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if %errorLevel% neq 0 (
        echo [X] Failed to install Node.js. Please install manually from https://nodejs.org
        echo     Then run this installer again.
        pause
        exit /b 1
    )
    echo [✓] Node.js installed successfully!
    REM Refresh PATH
    call refreshenv >nul 2>&1 || set "PATH=%PATH%;%ProgramFiles%\nodejs"
) else (
    for /f "tokens=*" %%i in ('node --version') do echo [✓] Node.js found: %%i
)

REM Step 2: Check for npm
echo [2/6] Checking for npm...
where npm >nul 2>&1
if %errorLevel% neq 0 (
    echo [X] npm not found. Please reinstall Node.js from https://nodejs.org
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do echo [✓] npm found: %%i
)

REM Step 3: Install Node.js dependencies
echo [3/6] Installing Node.js dependencies...
call npm install --legacy-peer-deps
if %errorLevel% neq 0 (
    echo [!] Some npm packages failed. Trying again with force...
    call npm install --force --legacy-peer-deps
)
REM Ensure critical dependencies are installed
call npm install unified remark-parse remark-gfm remark-rehype rehype-stringify ink-syntax-highlight diff --save --legacy-peer-deps
echo [✓] Node.js dependencies installed!

REM Step 4: Install Playwright
echo [4/6] Installing Playwright browser automation...
call npm install playwright
if %errorLevel% neq 0 (
    echo [!] Playwright npm install failed. Continuing anyway...
)

REM Step 5: Install Playwright browsers (Chromium)
echo [5/6] Downloading Chromium browser for Playwright...
call npx playwright install chromium
if %errorLevel% neq 0 (
    echo [!] Playwright browser download failed.
    echo [i] You can try manually: npx playwright install chromium
)
echo [✓] Playwright installed!

REM Step 6: Verify installation
echo [6/6] Verifying installation...
echo.

REM Check core dependencies
echo Checking dependencies:
call node --version >nul 2>&1 && echo   [✓] Node.js || echo   [X] Node.js
call npm --version >nul 2>&1 && echo   [✓] npm || echo   [X] npm
if exist "node_modules\playwright" (
    echo   [✓] Playwright
) else (
    echo   [!] Playwright (may need manual install)
)
if exist "node_modules\ink" (
    echo   [✓] Ink (TUI framework)
) else (
    echo   [!] Ink not found - run 'npm install'
)

echo.
echo ══════════════════════════════════════════════════════════════════
echo   Installation Complete!
echo.
echo   To start OpenQode TUI, run:
echo     node bin/opencode-ink.mjs
echo.
echo   Or use the shortcut:
echo     npm start
echo ══════════════════════════════════════════════════════════════════
echo.

pause
