#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  OpenQode TUI - Full Auto Installer (macOS)                       ║
# ║  This script installs EVERYTHING needed - just run it!            ║
# ╚══════════════════════════════════════════════════════════════════╝

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       OpenQode TUI - macOS Auto Installer                    ║"
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

# Step 1: Check for Homebrew
echo "[1/6] Checking for Homebrew..."
if ! command -v brew &> /dev/null; then
    warning "Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for this session
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f "/usr/local/bin/brew" ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
    success "Homebrew installed!"
else
    success "Homebrew found: $(brew --version | head -1)"
fi

# Step 2: Check for Node.js
echo "[2/6] Checking for Node.js..."
if ! command -v node &> /dev/null; then
    warning "Node.js not found. Installing via Homebrew..."
    brew install node
    success "Node.js installed!"
else
    success "Node.js found: $(node --version)"
fi

# Step 3: Check for npm
echo "[3/6] Checking for npm..."
if ! command -v npm &> /dev/null; then
    error "npm not found. Please reinstall Node.js"
    exit 1
else
    success "npm found: $(npm --version)"
fi

# Step 4: Install Node.js dependencies
echo "[4/6] Installing Node.js dependencies..."
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    warning "Some npm packages failed. Trying with force..."
    npm install --force --legacy-peer-deps
fi
# Ensure critical markdown dependencies
npm install unified remark-parse remark-gfm remark-rehype rehype-stringify ink-syntax-highlight diff --save --legacy-peer-deps
success "Node.js dependencies installed!"

# Step 5: Install Playwright
echo "[5/6] Installing Playwright browser automation..."
npm install playwright
if [ $? -ne 0 ]; then
    warning "Playwright npm install had issues. Continuing..."
fi

# Step 6: Install Playwright browsers
echo "[6/6] Downloading Chromium browser for Playwright..."
npx playwright install chromium
if [ $? -ne 0 ]; then
    warning "Playwright browser download failed."
    info "You can try manually: npx playwright install chromium"
fi
success "Playwright installed!"

# Verify installation
echo ""
echo "Checking dependencies:"
command -v node &> /dev/null && success "Node.js" || error "Node.js"
command -v npm &> /dev/null && success "npm" || error "npm"
[ -d "node_modules/playwright" ] && success "Playwright" || warning "Playwright (may need manual install)"
[ -d "node_modules/ink" ] && success "Ink (TUI framework)" || warning "Ink not found - run 'npm install'"

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
