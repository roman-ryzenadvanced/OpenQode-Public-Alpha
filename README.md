# 🚀 OpenQode Public (GEN5 TUI Included!)

**The Next-Generation AI Coding Assistant for your Terminal.**
*Powered by Qwen & OpenCode.* !
[Initial fork of OpenCode with Qwen Code model access developed with [TRAE.AI IDE](https://www.trae.ai/s/WJtxyE) and [GLM 4.6 coding model](https://z.ai/subscribe?ic=R0K78RJKNW)

![OpenQode Next-Gen Interface](assets/screenshots/next-gen-1.png)

---

## 👋 Welcome to OpenQode
OpenQode is a powerful Terminal User Interface (TUI) that brings advanced AI coding capabilities directly to your command line. Whether you're debugging via SSH, coding on a cloud server, or just love the terminal, OpenQode is designed for you.

---

## ⚡ 1-Click Installation (Zero-Config)

### 🖥️ Windows (PowerShell)
Copy and paste this into PowerShell:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/roman-ryzenadvanced/OpenQode-Public-Alpha/main/install.ps1'))
```

### 🍎 macOS / 🐧 Linux (Bash)
Copy and paste this into your terminal:
```bash
curl -sL https://raw.githubusercontent.com/roman-ryzenadvanced/OpenQode-Public-Alpha/main/install.sh | bash
```

*(These scripts automatically download source, install dependencies, and launch the assistant)*

---

## 📦 Manual Installation

### Windows
1. **Download** the latest release.
2. Double-click **`OpenQode.bat`**.
   *(First run will automatically install dependencies)*

### Linux / Mac
1. Open terminal in the folder.
2. Run:
   ```bash
   chmod +x OpenQode.sh
   ./OpenQode.sh
   ```

---

## 🆚 Which Version Should I Use?
We recommend starting with **Next-Gen (Option 5)**!

| Feature | 🌟 **Next-Gen TUI (Gen 5)** | 🕰️ **Classic TUI (Gen 4)** |
| :--- | :--- | :--- |
| **Best For** | **Modern Experience** | **Low-Resource / Simple** |
| **Interface** | **Full Dashboard** with Split Panes | Single Scrolling Stream |
| **Visuals** | **Animated Borders**, RGB Pulse, Spinners | Static Text |
| **Interactivity**| **Interactive Menus** (Arrow Keys Selection) | Command-based only |
| **Computer Use** | **Command Execution** (Runs shell cmds) | Read-only |
| **SOLO Mode** | **Autonomous Operation** (Auto-heal, auto-execute) | N/A |
| **Auto-Approve** | **AutoRun Commands** without Y/N prompts | N/A |
| **Projects** | **Any Absolute Path** (e.g. E:\MyProject) | Subfolders Only |
| **Models** | **Visual Model Selector** (`/model`) | Manual Switch via CLI |
| **Thinking** | **Real-time Stats** (CPS, Tokens) | Basic Loading |

![Context and Stats](assets/screenshots/next-gen-2.png)

---

## 🤖 SOLO Mode & Auto-Approve

OpenQode Gen 5 introduces powerful automation features for hands-free coding:

![Features Panel](assets/features-panel.png)

### 🚀 SOLO Mode
When enabled, the AI operates autonomously - executing commands, writing files, and fixing errors without constant prompts.
- Toggle via `/solo on` or `/solo off`
- Visible in sidebar: `SOLO: ON` (magenta)

### ⚡ Auto-Approve (AutoRun)
Automatically approve and execute AI-suggested commands without Y/N confirmation.
- Toggle via `/auto`
- Visible in sidebar: `AutoRun: ON` (yellow)
- **Best used with SOLO mode** for fully autonomous operation

> 💡 **Tip:** Press `ESC` at any time to abort a running command!

---

## ⚡ Feature: Zero-Config Authentication
OpenQode attempts to use your existing Qwen CLI authentication. 
- Using standard **Option 5**, simply follow the prompts.
- If it's your first time, you may need to authenticate via browser.
- The assistant is designed to be "Hassle Free"!

### 🔑 Advanced Configuration
If you have your own API keys or specialized setup:
1. Copy `config.example.cjs` to `config.cjs`.
2. Edit `config.cjs` to add your keys.

---

## 🔗 Links & Community
- **GitHub:** [roman-ryzenadvanced/OpenQode-Public-Alpha](https://github.com/roman-ryzenadvanced/OpenQode-Public-Alpha)
- **Telegram:** [@openqode](https://t.me/VibeCodePrompterSystem)
- **Discord:** [Join Community](https://discord.gg/2nnMGB9Jdt)

*Made with ❤️ by @RomanRyzenAdvanced*
