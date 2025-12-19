#!/bin/bash
# ========================================================
# OpenQode v1.01 - Automated Installer for Linux
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
echo "  - Node.js (if not installed)"
echo "  - All dependencies"
echo "  - Goose Ultra IDE"
echo ""
echo "  Supported: Ubuntu, Debian, Fedora, Arch, and more"
echo ""
read -p "Press Enter to start installation..."
echo ""

# Detect package manager
detect_package_manager() {
    if command -v apt-get &> /dev/null; then
        PKG_MANAGER="apt"
        PKG_INSTALL="sudo apt-get install -y"
        PKG_UPDATE="sudo apt-get update"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
        PKG_INSTALL="sudo dnf install -y"
        PKG_UPDATE="sudo dnf check-update || true"
    elif command -v yum &> /dev/null; then
        PKG_MANAGER="yum"
        PKG_INSTALL="sudo yum install -y"
        PKG_UPDATE="sudo yum check-update || true"
    elif command -v pacman &> /dev/null; then
        PKG_MANAGER="pacman"
        PKG_INSTALL="sudo pacman -S --noconfirm"
        PKG_UPDATE="sudo pacman -Sy"
    elif command -v zypper &> /dev/null; then
        PKG_MANAGER="zypper"
        PKG_INSTALL="sudo zypper install -y"
        PKG_UPDATE="sudo zypper refresh"
    else
        PKG_MANAGER="unknown"
    fi
}

detect_package_manager
echo -e "${BOLD}[INFO]${NC} Detected package manager: $PKG_MANAGER"

# ========================================================
# NODE.JS CHECK AND INSTALL
# ========================================================
echo ""
echo -e "${BOLD}[STEP 1/4]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[INFO]${NC} Node.js not found. Installing..."
    
    case $PKG_MANAGER in
        apt)
            # Use NodeSource for latest LTS
            echo -e "${YELLOW}[INFO]${NC} Setting up NodeSource repository..."
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            $PKG_INSTALL nodejs
            ;;
        dnf|yum)
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
            $PKG_INSTALL nodejs
            ;;
        pacman)
            $PKG_INSTALL nodejs npm
            ;;
        zypper)
            $PKG_INSTALL nodejs npm
            ;;
        *)
            echo -e "${RED}[ERROR]${NC} Could not auto-install Node.js."
            echo "Please install Node.js manually from https://nodejs.org/"
            exit 1
            ;;
    esac
    echo -e "${GREEN}[OK]${NC} Node.js installed"
else
    NODE_VER=$(node --version)
    echo -e "${GREEN}[OK]${NC} Node.js $NODE_VER detected"
fi

# ========================================================
# NPM CHECK
# ========================================================
echo -e "${BOLD}[STEP 2/4]${NC} Checking npm..."
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}[INFO]${NC} npm not found. Installing..."
    case $PKG_MANAGER in
        apt)
            $PKG_INSTALL npm
            ;;
        pacman)
            $PKG_INSTALL npm
            ;;
        *)
            echo -e "${RED}[ERROR]${NC} npm not found. Please install manually."
            exit 1
            ;;
    esac
fi
NPM_VER=$(npm --version)
echo -e "${GREEN}[OK]${NC} npm $NPM_VER detected"

# ========================================================
# ROOT DEPENDENCIES
# ========================================================
echo -e "${BOLD}[STEP 3/4]${NC} Installing root dependencies..."
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
echo -e "${BOLD}[STEP 4/4]${NC} Installing Goose Ultra IDE dependencies..."
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
chmod +x install-macos.sh 2>/dev/null || true
chmod +x install.sh 2>/dev/null || true
chmod +x start.sh 2>/dev/null || true

# ========================================================
# INSTALL ELECTRON DEPENDENCIES (for GUI)
# ========================================================
echo ""
echo -e "${BOLD}[OPTIONAL]${NC} Installing Electron dependencies for GUI support..."
case $PKG_MANAGER in
    apt)
        sudo apt-get install -y libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libsecret-1-0 2>/dev/null || true
        ;;
    dnf|yum)
        sudo $PKG_MANAGER install -y gtk3 libXScrnSaver libnotify nss 2>/dev/null || true
        ;;
    pacman)
        sudo pacman -S --noconfirm gtk3 libnotify nss libxss 2>/dev/null || true
        ;;
esac
echo -e "${GREEN}[OK]${NC} Electron dependencies checked"

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
