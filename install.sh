#!/bin/bash
# OpenQode One-Liner Installer for Linux/Mac

echo -e "\033[0;36mOpenQode Auto-Installer\033[0m"
echo -e "\033[0;36m-----------------------\033[0m"

# Check Git
if ! command -v git &> /dev/null; then
    echo -e "\033[0;31mError: Git is not installed.\033[0m"
    echo "Please install Git (e.g., sudo apt install git or brew install git)"
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo -e "\033[0;31mError: Node.js is not installed.\033[0m"
    echo "Please install Node.js: https://nodejs.org/"
    exit 1
fi

TARGET_DIR="OpenQode"
REPO_URL="https://github.com/roman-ryzenadvanced/OpenQode-Public-Alpha.git"

if [ -d "$TARGET_DIR" ]; then
    echo -e "\033[1;33mDirectory '$TARGET_DIR' already exists. Updating...\033[0m"
    cd "$TARGET_DIR"
    git pull
    if [ $? -ne 0 ]; then
        echo -e "\033[0;31mUpdate failed. Please delete the directory and try again.\033[0m"
        exit 1
    fi
    cd ..
else
    echo -e "\033[1;33mCloning repository...\033[0m"
    git clone "$REPO_URL" "$TARGET_DIR"
    if [ $? -ne 0 ]; then
        echo -e "\033[0;31mClone failed.\033[0m"
        exit 1
    fi
fi

cd "$TARGET_DIR"

if [ ! -d "node_modules" ]; then
    echo -e "\033[1;33mInstalling dependencies...\033[0m"
    npm install
else
    echo -e "\033[0;32mDependencies already installed.\033[0m"
fi

echo -e "\033[0;32mInstallation complete! Launching...\033[0m"
chmod +x OpenQode.sh
./OpenQode.sh
