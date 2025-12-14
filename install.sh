#!/bin/bash
# OpenQode Auto-Installer for macOS / Linux
# Noob-proof: Auto-installs Node.js and Git if missing!

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}  ╔═══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║       🚀 OpenQode Auto-Installer 🚀       ║${NC}"
echo -e "${CYAN}  ║      Next-Gen AI Coding Assistant         ║${NC}"
echo -e "${CYAN}  ╚═══════════════════════════════════════════╝${NC}"
echo ""

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ -f /etc/debian_version ]]; then
        echo "debian"
    elif [[ -f /etc/redhat-release ]]; then
        echo "redhat"
    elif [[ -f /etc/arch-release ]]; then
        echo "arch"
    else
        echo "linux"
    fi
}

OS=$(detect_os)
echo -e "${CYAN}[*] Detected OS: $OS${NC}"

# Install Git if missing
install_git() {
    echo -e "${YELLOW}[!] Git not found. Installing...${NC}"
    case $OS in
        macos)
            if command -v brew &> /dev/null; then
                brew install git
            else
                echo -e "${YELLOW}[!] Installing Homebrew first...${NC}"
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                brew install git
            fi
            ;;
        debian)
            sudo apt-get update
            sudo apt-get install -y git
            ;;
        redhat)
            sudo yum install -y git || sudo dnf install -y git
            ;;
        arch)
            sudo pacman -S --noconfirm git
            ;;
        *)
            echo -e "${RED}[X] Please install Git manually for your distribution${NC}"
            exit 1
            ;;
    esac
}

# Install Node.js if missing
install_node() {
    echo -e "${YELLOW}[!] Node.js not found. Installing...${NC}"
    case $OS in
        macos)
            if command -v brew &> /dev/null; then
                brew install node
            else
                echo -e "${YELLOW}[!] Installing via nvm...${NC}"
                curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
                export NVM_DIR="$HOME/.nvm"
                [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
                nvm install --lts
            fi
            ;;
        debian)
            # Using NodeSource
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        redhat)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs || sudo dnf install -y nodejs
            ;;
        arch)
            sudo pacman -S --noconfirm nodejs npm
            ;;
        *)
            echo -e "${YELLOW}[!] Installing via nvm (universal)...${NC}"
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
            nvm install --lts
            ;;
    esac
}

# Step 1: Check Git
echo -e "${CYAN}[1/4] Checking for Git...${NC}"
if ! command -v git &> /dev/null; then
    install_git
fi
if ! command -v git &> /dev/null; then
    echo -e "${RED}[X] Git installation failed. Please install manually.${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Git is installed!${NC}"

# Step 2: Check Node.js
echo -e "${CYAN}[2/4] Checking for Node.js...${NC}"
if ! command -v node &> /dev/null; then
    install_node
    # Reload PATH for nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi
if ! command -v node &> /dev/null; then
    echo -e "${RED}[X] Node.js installation failed. Please install manually: https://nodejs.org/${NC}"
    exit 1
fi
NODE_VER=$(node --version)
echo -e "${GREEN}[✓] Node.js $NODE_VER is installed!${NC}"

# Step 3: Clone or update repository
TARGET_DIR="OpenQode"
REPO_URL="https://github.com/roman-ryzenadvanced/OpenQode-Public-Alpha.git"

echo -e "${CYAN}[3/4] Setting up OpenQode...${NC}"
if [ -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}[*] Directory exists. Updating...${NC}"
    cd "$TARGET_DIR"
    git pull --ff-only || true
    cd ..
else
    echo -e "${YELLOW}[*] Cloning repository...${NC}"
    git clone "$REPO_URL" "$TARGET_DIR"
fi

# Step 4: Install dependencies (clean install to ensure React overrides work)
cd "$TARGET_DIR"
echo -e "${CYAN}[4/4] Installing dependencies...${NC}"

# Clean existing node_modules to ensure React overrides take effect
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}[*] Cleaning existing dependencies for fresh install...${NC}"
    rm -rf node_modules package-lock.json
fi

npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}[!] Retrying npm install...${NC}"
    npm cache clean --force
    npm install --legacy-peer-deps
fi

echo ""
echo -e "${GREEN}  ╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}  ║     ✅ Installation Complete! ✅          ║${NC}"
echo -e "${GREEN}  ║                                           ║${NC}"
echo -e "${GREEN}  ║   Launching OpenQode Next-Gen TUI...      ║${NC}"
echo -e "${GREEN}  ╚═══════════════════════════════════════════╝${NC}"
echo ""

# Make executable and launch
chmod +x OpenQode.sh
./OpenQode.sh
