#!/bin/bash
# OpenQode v1.3 Alpha - Linux/Mac Launcher

# Auto-Install Logic
PWD=$(dirname "$0")
cd "$PWD"

echo "========================================"
echo "  OpenQode Auto-Check"
echo "========================================"

if [ ! -d "node_modules" ]; then
    echo "[INFO] First run detected! Installing dependencies..."
    npm install --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies. Please install Node.js."
        exit 1
    fi
    echo "[SUCCESS] Dependencies installed!"
    echo ""
fi

# Functions
pause() {
    read -p "Press Enter to continue..."
}

start_webgui() {
    echo "Starting Web GUI..."
    node server.js 15044 &
    SERVER_PID=$!
    sleep 2
    if command -v xdg-open &> /dev/null; then xdg-open http://localhost:15044; elif command -v open &> /dev/null; then open http://localhost:15044; fi
    wait $SERVER_PID
}

start_qwentui() {
    if ! command -v qwen &> /dev/null; then
        echo "Error: qwen CLI not found. Install with: npm install -g @anthropic/qwen-code"
        pause
        return
    fi
    qwen
}

start_nodetui() {
    echo "Starting Classic TUI..."
    node bin/opencode-tui.cjs
}

start_inktui() {
    echo "Starting Next-Gen TUI..."
    node bin/opencode-ink.mjs
}

# Menu Loop
while true; do
    clear
    echo "========================================"
    echo "  OpenQode v1.3 Alpha"
    echo "========================================"
    echo ""
    echo "  [1] Web GUI"
    echo "  [2] Qwen TUI (CLI)"
    echo "  [3] (Windows Only Feature)"
    echo "  [4] TUI Classic (Gen 4)"
    echo "  [5] ★ NEXT-GEN TUI (Gen 5) - Recommended!"
    echo "  [6] Agent Manager"
    echo "  [7] 🔧 Smart Repair (Fix TUI crashes)"
    echo "  [8] Exit"
    echo ""
    read -p "Enter choice: " choice

    case $choice in
        1) start_webgui ;;
        2) start_qwentui ;;
        3) echo "Not available on Mac/Linux."; pause ;;
        4) start_nodetui ;;
        5) start_inktui ;;
        6) echo "Use Windows version for Agent Manager (or edit files manually)"; pause ;;
        7) echo "Starting Smart Repair..."; node bin/smart-repair.mjs ;;
        8) exit 0 ;;
        *) echo "Invalid choice"; pause ;;
    esac
done
