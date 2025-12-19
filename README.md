# 🚀 OpenQode v1.01 - Goose Ultra Edition

**The Next-Generation AI-Powered IDE for Modern Developers.**  
*Powered by Qwen AI • Built with Electron • Full-Stack Development Made Easy*

![Goose Ultra Interface](assets/screenshots/next-gen-1.png)

---

## 🎯 What is OpenQode?

OpenQode is a comprehensive AI coding assistant that brings the power of large language models directly to your development workflow. The flagship **Goose Ultra** application provides a beautiful, feature-rich IDE experience with:

- 🤖 **AI-Powered Code Generation** - Generate entire applications from natural language descriptions
- 🎨 **Modern UI/UX** - Glass morphism design with smooth animations
- 📁 **Project Management** - Create, manage, and iterate on multiple projects
- 🔧 **Vi Control Panel** - Computer automation, browser control, and more
- 💬 **Intelligent Chat** - Context-aware conversations with file attachments
- 🧠 **Memory System** - The AI remembers your preferences and project context

---

## ⚡ Quick Start

### Windows
```batch
# Run the installer (first time only)
Install.bat

# Launch OpenQode
OpenQode.bat
```

### macOS
```bash
# Make scripts executable and install
chmod +x install-macos.sh OpenQode.sh
./install-macos.sh

# Launch OpenQode
./OpenQode.sh
```

### Linux (Ubuntu/Debian/Fedora/Arch)
```bash
# Make scripts executable and install
chmod +x install-linux.sh OpenQode.sh
./install-linux.sh

# Launch OpenQode
./OpenQode.sh
```

---

## 📋 Launch Menu Options

| Option | Name | Description |
|--------|------|-------------|
| **1** | 🚀 **GOOSE ULTRA** | The flagship IDE experience (Recommended!) |
| **2** | Goose Ultra DEV | Development mode with hot-reload |
| **3** | Next-Gen TUI (Gen 5) | Terminal-based interface with Ink |
| **4** | TUI Classic (Gen 4) | Lightweight terminal interface |
| **5** | Qwen Authentication | Login/refresh Qwen credentials |
| **8** | Smart Repair | Fix common issues automatically |

---

## ✨ Features

### 🖥️ Goose Ultra IDE

The main attraction - a full-featured desktop IDE built with Electron:

- **Visual Blueprint System** - Describe what you want, get a plan, approve, and build
- **Live Preview** - See your application rendered in real-time
- **Code Editor** - Monaco editor with syntax highlighting
- **Multi-Persona Chat** - Switch between different AI personalities
- **File Attachments** - Drag and drop files for context
- **Project History** - All your projects saved and accessible

### 🔧 Vi Control Panel (Enhanced)

Advanced automation capabilities with new robust connectivity:

- **Computer Use** - AI-controlled desktop automation
- **Browser Control** - Automated web interactions
- **Vision Analysis** - Screenshot and analyze UI elements with Qwen VL
- **Remote Hosts** - Enhanced SSH connection management with automatic password fallback
- **Credential Vault** - Secure password/key storage
- **Local Engine** - Quick Diagnostics and PowerShell integration

### 🎨 Design System

- **Apex Mode** - Elite-level code quality enforcement
- **Competitive Intelligence** - AI researches top competitors for design inspiration
- **Mobile-First** - All generated code is responsive by default

---

## 🛠️ System Requirements

### Minimum
- **Node.js** 18.0 or higher
- **npm** 8.0 or higher
- **4GB RAM** for TUI mode
- **8GB RAM** for Goose Ultra IDE

### Recommended
- **Node.js** 20.x LTS
- **16GB RAM** for best performance
- **SSD storage** for fast project loading

---

## 📁 Project Structure

```
OpenQode/
├── bin/
│   ├── goose-ultra-final/    # Main Electron IDE
│   ├── opencode-ink.mjs      # Gen 5 TUI
│   ├── opencode-tui.cjs      # Gen 4 TUI
│   └── smart-repair.mjs      # Auto-repair tool
├── Documentation/            # All docs and planning files
├── assets/                   # Screenshots and images
├── Install.bat              # Windows installer
├── install-macos.sh         # macOS installer
├── install-linux.sh         # Linux installer
├── OpenQode.bat             # Windows launcher
├── OpenQode.sh              # macOS/Linux launcher
└── README.md                # This file
```

---

## 🔐 Authentication

OpenQode uses **Qwen AI** for its language model capabilities. Authentication is handled automatically:

1. **First Launch** - The app will prompt you to authenticate
2. **Browser Login** - A browser window opens for Qwen login
3. **Token Storage** - Credentials are stored locally and encrypted
4. **Auto-Refresh** - Tokens are refreshed automatically

If you need to re-authenticate, use **Option 5** in the launcher menu.

---

## 🐛 Troubleshooting

### "Node.js not found"
Run the installer script for your platform:
- Windows: `Install.bat`
- macOS: `./install-macos.sh`
- Linux: `./install-linux.sh`

### "Build failed"
```bash
# In the goose-ultra-final directory:
cd bin/goose-ultra-final
npm install --legacy-peer-deps
npm run build
```

### "Qwen authentication failed"
Use **Option 5** (Qwen Authentication) in the launcher to re-authenticate.

### TUI crashes or hangs
Use **Option 8** (Smart Repair) to automatically diagnose and fix issues.

---

## 🔗 Links & Community

- **GitHub:** [roman-ryzenadvanced/OpenQode-Public-Alpha](https://github.com/roman-ryzenadvanced/OpenQode-Public-Alpha)
- **Telegram:** [@openqode](https://t.me/VibeCodePrompterSystem)
- **Discord:** [Join Community](https://discord.gg/2nnMGB9Jdt)

---

## 📄 License

This project is provided as-is for educational and development purposes.  
See [LICENSE](LICENSE) for details.

---

*Made with ❤️ by @RomanRyzenAdvanced*  
*Powered by Qwen AI • Developed with [TRAE.AI IDE](https://www.trae.ai/)*
