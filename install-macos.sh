#!/bin/bash
# ========================================================
# OpenQode v1.01 - Automated Installer for macOS
# ========================================================

set -e
cd "$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}========================================================"
echo "  OpenQode v1.01 - AUTOMATED INSTALLATION WIZARD"
echo -e "========================================================${NC}"
echo ""
echo "  This installer will set up everything you need:"
echo "  - Homebrew (if not installed)"
echo "  - Node.js (if not installed)"
echo "  - All dependencies"
echo "  - Goose Ultra IDE"
echo ""
read -p "Press Enter to start installation..."
echo ""

# ========================================================
# HOMEBREW CHECK AND INSTALL
# ========================================================
echo -e "${BOLD}[STEP 1/5]${NC} Checking Homebrew..."
if ! command -v brew &> /dev/null; then
    echo -e "${YELLOW}[INFO]${NC} Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add brew to PATH for this session (Apple Silicon)
    if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f /usr/local/bin/brew ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
    
    echo -e "${GREEN}[OK]${NC} Homebrew installed"
else
    echo -e "${GREEN}[OK]${NC} Homebrew detected"
fi

# ========================================================
# NODE.JS CHECK AND INSTALL
# ========================================================
echo -e "${BOLD}[STEP 2/5]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[INFO]${NC} Node.js not found. Installing via Homebrew..."
    brew install node
    echo -e "${GREEN}[OK]${NC} Node.js installed"
else
    NODE_VER=$(node --version)
    echo -e "${GREEN}[OK]${NC} Node.js $NODE_VER detected"
fi

# ========================================================
# NPM CHECK
# ========================================================
echo -e "${BOLD}[STEP 3/5]${NC} Checking npm..."
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} npm not found! Reinstalling Node.js..."
    brew reinstall node
fi
NPM_VER=$(npm --version)
echo -e "${GREEN}[OK]${NC} npm $NPM_VER detected"

# ========================================================
# ROOT DEPENDENCIES
# ========================================================
echo -e "${BOLD}[STEP 4/5]${NC} Installing root dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}[OK]${NC} Root dependencies already installed"
else
    echo -e "${YELLOW}[INFO]${NC} Running npm install..."
    npm install --legacy-peer-deps 2>/dev/null || npm install
    echo -e "${GREEN}[OK]${NC} Root dependencies installed"
fi

# ========================================================
# GOOSE ULTRA DEPENDENCIES
# ========================================================
echo -e "${BOLD}[STEP 5/5]${NC} Installing Goose Ultra IDE dependencies..."
if [ -d "bin/goose-ultra-final/node_modules" ]; then
    echo -e "${GREEN}[OK]${NC} Goose Ultra dependencies already installed"
else
    pushd bin/goose-ultra-final > /dev/null
    echo -e "${YELLOW}[INFO]${NC} Running npm install in Goose Ultra..."
    npm install --legacy-peer-deps 2>/dev/null || npm install
    
    # Pre-build
    echo -e "${YELLOW}[INFO]${NC} Pre-building Goose Ultra..."
    npm run build 2>/dev/null || true
    popd > /dev/null
    echo -e "${GREEN}[OK]${NC} Goose Ultra dependencies installed"
fi

# ========================================================
# MAKE SCRIPTS EXECUTABLE
# ========================================================
chmod +x OpenQode.sh 2>/dev/null || true
chmod +x install-linux.sh 2>/dev/null || true
chmod +x install.sh 2>/dev/null || true
chmod +x start.sh 2>/dev/null || true

# ========================================================
# VERIFICATION
# ========================================================
echo ""
echo -e "${CYAN}========================================================"
echo "  INSTALLATION COMPLETE"
echo -e "========================================================${NC}"
echo ""
echo "  Checking installation..."

ERRORS=0

if command -v node &> /dev/null; then
    echo -e "  ${GREEN}[OK]${NC} Node.js"
else
    echo -e "  ${RED}[FAIL]${NC} Node.js"
    ((ERRORS++))
fi

if command -v npm &> /dev/null; then
    echo -e "  ${GREEN}[OK]${NC} npm"
else
    echo -e "  ${RED}[FAIL]${NC} npm"
    ((ERRORS++))
fi

if [ -d "node_modules" ]; then
    echo -e "  ${GREEN}[OK]${NC} Root dependencies"
else
    echo -e "  ${RED}[FAIL]${NC} Root dependencies"
    ((ERRORS++))
fi

if [ -d "bin/goose-ultra-final/node_modules" ]; then
    echo -e "  ${GREEN}[OK]${NC} Goose Ultra dependencies"
else
    echo -e "  ${RED}[FAIL]${NC} Goose Ultra dependencies"
    ((ERRORS++))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "  ${GREEN}==========================================="
    echo "  ALL CHECKS PASSED! Ready to launch."
    echo -e "  ===========================================${NC}"
    echo ""
    echo "  Run ./OpenQode.sh to start the application!"
    echo ""
else
    echo -e "  ${RED}==========================================="
    echo "  SOME CHECKS FAILED ($ERRORS errors)"
    echo -e "  ===========================================${NC}"
    echo ""
    echo "  Try running this installer again."
    echo ""
fi

exit $ERRORS
