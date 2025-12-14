# OpenQode Auto-Installer for Windows (PowerShell)
# Noob-proof: Auto-installs Node.js and Git if missing!

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║       🚀 OpenQode Auto-Installer 🚀       ║" -ForegroundColor Cyan
Write-Host "  ║      Next-Gen AI Coding Assistant         ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Function to check if running as admin
function Test-Admin {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Function to install winget package
function Install-WingetPackage($PackageId, $Name) {
    Write-Host "[*] Installing $Name..." -ForegroundColor Yellow
    try {
        winget install --id $PackageId --accept-package-agreements --accept-source-agreements -e
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[✓] $Name installed successfully!" -ForegroundColor Green
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            return $true
        }
    } catch {
        Write-Host "[!] winget failed, trying alternative method..." -ForegroundColor Yellow
    }
    return $false
}

# Check for Git
Write-Host "[1/4] Checking for Git..." -ForegroundColor Cyan
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Git not found. Installing..." -ForegroundColor Yellow
    $installed = Install-WingetPackage "Git.Git" "Git"
    if (!$installed) {
        Write-Host "[!] Attempting direct download..." -ForegroundColor Yellow
        $gitInstaller = "$env:TEMP\git-installer.exe"
        Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe" -OutFile $gitInstaller
        Start-Process -FilePath $gitInstaller -Args "/VERYSILENT /NORESTART" -Wait
        Remove-Item $gitInstaller -Force
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
    if (!(Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host "[X] Failed to install Git. Please install manually: https://git-scm.com/download/win" -ForegroundColor Red
        exit 1
    }
}
Write-Host "[✓] Git is installed!" -ForegroundColor Green

# Check for Node.js
Write-Host "[2/4] Checking for Node.js..." -ForegroundColor Cyan
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Node.js not found. Installing..." -ForegroundColor Yellow
    $installed = Install-WingetPackage "OpenJS.NodeJS.LTS" "Node.js LTS"
    if (!$installed) {
        Write-Host "[!] Attempting direct download..." -ForegroundColor Yellow
        $nodeInstaller = "$env:TEMP\node-installer.msi"
        Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi" -OutFile $nodeInstaller
        Start-Process msiexec.exe -Args "/i `"$nodeInstaller`" /qn ADDLOCAL=ALL" -Wait
        Remove-Item $nodeInstaller -Force
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "[X] Failed to install Node.js. Please install manually: https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
}
$nodeVer = node --version
Write-Host "[✓] Node.js $nodeVer is installed!" -ForegroundColor Green

# Clone or update repository
$repoUrl = "https://github.com/roman-ryzenadvanced/OpenQode-Public-Alpha.git"
$targetDir = "OpenQode"

Write-Host "[3/4] Setting up OpenQode..." -ForegroundColor Cyan
if (Test-Path $targetDir) {
    Write-Host "[*] Directory exists. Updating..." -ForegroundColor Yellow
    Push-Location $targetDir
    git pull --ff-only
    Pop-Location
} else {
    Write-Host "[*] Cloning repository..." -ForegroundColor Yellow
    git clone $repoUrl $targetDir
}

# Install npm dependencies (clean install to ensure React overrides work)
Set-Location $targetDir
Write-Host "[4/4] Installing dependencies..." -ForegroundColor Cyan

# Clean existing node_modules to ensure React overrides take effect
if (Test-Path "node_modules") {
    Write-Host "[*] Cleaning existing dependencies for fresh install..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue
}

npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] npm install failed, retrying..." -ForegroundColor Yellow
    npm cache clean --force
    npm install --legacy-peer-deps
}

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║     ✅ Installation Complete! ✅          ║" -ForegroundColor Green
Write-Host "  ║                                           ║" -ForegroundColor Green
Write-Host "  ║   Launching OpenQode Next-Gen TUI...      ║" -ForegroundColor Green
Write-Host "  ╚═══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Launch
.\OpenQode.bat
