Write-Host "OpenQode Auto-Installer" -ForegroundColor Cyan
Write-Host "-----------------------" -ForegroundColor Cyan

# Check for Git
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Git is not installed." -ForegroundColor Red
    Write-Host "Please install Git: https://git-scm.com/download/win"
    exit
}

# Check for Node
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed." -ForegroundColor Red
    Write-Host "Please install Node.js: https://nodejs.org/"
    exit
}

$repoUrl = "https://github.com/roman-ryzenadvanced/OpenQode-Public-Alpha.git"
$targetDir = "OpenQode"

if (Test-Path $targetDir) {
    Write-Host "Directory '$targetDir' already exists. Updating..." -ForegroundColor Yellow
    Push-Location $targetDir
    git pull
    Pop-Location
} else {
    Write-Host "Cloning repository..." -ForegroundColor Yellow
    git clone $repoUrl $targetDir
}

Set-Location $targetDir

if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "Dependencies already installed." -ForegroundColor Green
}

Write-Host "Installation complete! Launching..." -ForegroundColor Green
.\OpenQode.bat
