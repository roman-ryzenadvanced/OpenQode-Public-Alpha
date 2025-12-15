#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  OpenQode TUI - Full Auto Installer (Linux)                       ║
# ║  This script installs EVERYTHING needed - just run it!            ║
# ║  Supports: Ubuntu/Debian, Fedora/RHEL, Arch Linux                 ║
# ╚══════════════════════════════════════════════════════════════════╝

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       OpenQode TUI - Linux Auto Installer                    ║"
echo "║       This will install all required dependencies            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() { echo -e "${GREEN}[✓]${NC} $1"; }
warning() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[X]${NC} $1"; }
info() { echo -e "    $1"; }

# Detect package manager
detect_pm() {
    if command -v apt-get &> /dev/null; then
        PM="apt"
        INSTALL="sudo apt-get install -y"
    elif command -v dnf &> /dev/null; then
        PM="dnf"
        INSTALL="sudo dnf install -y"
    elif command -v yum &> /dev/null; then
        PM="yum"
        INSTALL="sudo yum install -y"
    elif command -v pacman &> /dev/null; then
        PM="pacman"
        INSTALL="sudo pacman -S --noconfirm"
    else
        error "Could not detect package manager. Please install Node.js manually."
        exit 1
    fi
    success "Detected package manager: $PM"
}

# Step 1: Detect package manager
echo "[1/7] Detecting package manager..."
detect_pm

# Step 2: Update package lists
echo "[2/7] Updating package lists..."
case $PM in
    apt) sudo apt-get update -qq ;;
    dnf|yum) sudo $PM check-update || true ;;
    pacman) sudo pacman -Sy ;;
esac
success "Package lists updated!"

# Step 3: Install Node.js
echo "[3/7] Checking for Node.js..."
if ! command -v node &> /dev/null; then
    warning "Node.js not found. Installing..."
    case $PM in
        apt)
            # Install Node.js 20.x LTS from NodeSource
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        dnf|yum)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo $PM install -y nodejs
            ;;
        pacman)
            sudo pacman -S --noconfirm nodejs npm
            ;;
    esac
    success "Node.js installed!"
else
    success "Node.js found: $(node --version)"
fi

# Step 4: Check for npm
echo "[4/7] Checking for npm..."
if ! command -v npm &> /dev/null; then
    error "npm not found. Please reinstall Node.js"
    exit 1
else
    success "npm found: $(npm --version)"
fi

# Step 5: Install Playwright dependencies (browser libs)
echo "[5/7] Installing Playwright system dependencies..."
case $PM in
    apt)
        # Install deps for Chromium on Debian/Ubuntu
        $INSTALL libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
            libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
            libasound2 libpango-1.0-0 libcairo2 2>/dev/null || warning "Some Playwright deps may be missing"
        ;;
    dnf|yum)
        $INSTALL nss nspr atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite \
            libXdamage libXfixes libXrandr mesa-libgbm alsa-lib pango cairo 2>/dev/null || warning "Some Playwright deps may be missing"
        ;;
    pacman)
        $INSTALL nss nspr atk at-spi2-atk libcups libdrm libxkbcommon libxcomposite \
            libxdamage libxfixes libxrandr mesa alsa-lib pango cairo 2>/dev/null || warning "Some Playwright deps may be missing"
        ;;
esac
success "System dependencies installed!"

# Step 6: Install Node.js dependencies
echo "[6/7] Installing Node.js dependencies..."
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    warning "Some npm packages failed. Trying with force..."
    npm install --force --legacy-peer-deps
fi
# Ensure critical markdown dependencies
npm install unified remark-parse remark-gfm remark-rehype rehype-stringify ink-syntax-highlight diff --save --legacy-peer-deps
success "Node.js dependencies installed!"

# Step 7: Install Playwright
echo "[7/7] Installing Playwright browser automation..."
npm install playwright
npx playwright install chromium
if [ $? -ne 0 ]; then
    warning "Playwright browser download had issues."
    info "You can try: npx playwright install-deps chromium"
fi
success "Playwright installed!"

# Verify installation
echo ""
echo "Checking dependencies:"
command -v node &> /dev/null && success "Node.js" || error "Node.js"
command -v npm &> /dev/null && success "npm" || error "npm"
[ -d "node_modules/playwright" ] && success "Playwright" || warning "Playwright (may need manual install)"
[ -d "node_modules/ink" ] && success "Ink (TUI framework)" || warning "Ink not found - run 'npm install'"
[ -d "node_modules/unified" ] && success "unified (markdown)" || warning "unified not found - run 'npm install'"

echo ""
echo "══════════════════════════════════════════════════════════════════"
echo "  Installation Complete!"
echo ""
echo "  To start OpenQode TUI, run:"
echo "    node bin/opencode-ink.mjs"
echo ""
echo "  Or use the shortcut:"
echo "    npm start"
echo "══════════════════════════════════════════════════════════════════"
echo ""
