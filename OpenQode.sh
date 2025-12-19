#!/bin/bash
# OpenQode v1.01 - Unified Launcher for macOS/Linux
# ===================================================

set -e
cd "$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}========================================"
echo "  OpenQode v1.01 - AI Coding Assistant"
echo -e "========================================${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed!${NC}"
    echo "Please run the install script first:"
    echo "  macOS:  ./install-macos.sh"
    echo "  Linux:  ./install-linux.sh"
    exit 1
fi
echo -e "${GREEN}[OK]${NC} Node.js $(node --version) detected"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[INFO]${NC} First run - Installing dependencies..."
    npm install --legacy-peer-deps 2>/dev/null || npm install
fi

if [ ! -d "bin/goose-ultra-final/node_modules" ]; then
    echo -e "${YELLOW}[INFO]${NC} Installing Goose Ultra dependencies..."
    pushd bin/goose-ultra-final > /dev/null
    npm install --legacy-peer-deps 2>/dev/null || npm install
    popd > /dev/null
fi
echo -e "${GREEN}[OK]${NC} Dependencies ready"

show_menu() {
    clear
    echo ""
    echo -e "${CYAN}========================================"
    echo "  OPENQODE v1.01 - LAUNCH MENU"
    echo -e "========================================${NC}"
    echo ""
    echo "  RECOMMENDED:"
    echo "  [1] *** GOOSE ULTRA *** (Full IDE Experience)"
    echo "  [2] GOOSE ULTRA DEV (Live Reload Mode)"
    echo ""
    echo "  TERMINAL INTERFACES:"
    echo "  [3] Next-Gen TUI (Gen 5 - Ink)"
    echo "  [4] TUI Classic (Gen 4 - Node.js)"
    echo ""
    echo "  TOOLS:"
    echo "  [5] Qwen Authentication (Login/Refresh)"
    echo "  [8] Smart Repair (Fix TUI crashes)"
    echo "  [9] Check Updates"
    echo ""
    echo "  [0] Exit"
    echo ""
}

launch_goose() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo "  GOOSE ULTRA - Production Mode"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo "Building Goose Ultra..."
    
    pushd bin/goose-ultra-final > /dev/null
    
    if ! npm run build; then
        echo -e "${YELLOW}[WARNING]${NC} Build failed, attempting recovery..."
        npm install --legacy-peer-deps
        npm run build
    fi
    
    echo ""
    echo "Starting Goose Ultra..."
    npx electron . &
    popd > /dev/null
    
    echo ""
    echo -e "${GREEN}Goose Ultra launched!${NC} Check for the window."
    sleep 2
}

launch_goose_dev() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo "  GOOSE ULTRA DEV MODE"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    
    pushd bin/goose-ultra-final > /dev/null
    npm run dev &
    sleep 5
    GOOSE_DEV=true npx electron . &
    popd > /dev/null
    
    echo ""
    echo -e "${GREEN}Dev mode started!${NC} Edits will hot-reload."
    sleep 2
}

launch_ink_tui() {
    echo ""
    echo "Starting Next-Gen TUI (Gen 5)..."
    node bin/auth-check.mjs --quiet 2>/dev/null || true
    node --experimental-require-module bin/opencode-ink.mjs
    read -p "Press Enter to continue..."
}

launch_classic_tui() {
    echo ""
    echo "Starting TUI Classic (Gen 4)..."
    node bin/opencode-tui.cjs
    read -p "Press Enter to continue..."
}

qwen_auth() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo "  QWEN AUTHENTICATION"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo "Starting Qwen authentication flow..."
    echo ""
    node bin/auth.js
    read -p "Press Enter to continue..."
}

smart_repair() {
    echo ""
    echo "Running Smart Repair..."
    node bin/smart-repair.mjs
    read -p "Press Enter to continue..."
}

check_updates() {
    echo ""
    echo "Checking for updates..."
    if git pull 2>/dev/null; then
        echo -e "${GREEN}[OK]${NC} Repository updated! Please restart the launcher."
    else
        echo -e "${YELLOW}[INFO]${NC} Git not available or not a git repository."
    fi
    read -p "Press Enter to continue..."
}

# Main loop
while true; do
    show_menu
    read -p "Enter choice (0-9): " choice
    
    case $choice in
        1) launch_goose ;;
        2) launch_goose_dev ;;
        3) launch_ink_tui ;;
        4) launch_classic_tui ;;
        5) qwen_auth ;;
        8) smart_repair ;;
        9) check_updates ;;
        0) echo ""; echo "Goodbye!"; exit 0 ;;
        *) echo "Invalid choice."; sleep 1 ;;
    esac
done
