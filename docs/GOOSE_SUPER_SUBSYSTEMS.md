# 🦆 GOOSE SUPER - CORE SUBSYSTEMS DETAILED SPECIFICATIONS

## Table of Contents
1. [Playwright Integration](#1-playwright-integration)
2. [Browser Use System](#2-browser-use-system)
3. [Computer Use System](#3-computer-use-system)
4. [Full Vision Capabilities](#4-full-vision-capabilities)
5. [Vibe Server Management](#5-vibe-server-management)

---

# 1. Playwright Integration

## Purpose
Automate web browsers with precision - navigate, click, fill forms, extract data, take screenshots.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    PLAYWRIGHT SUBSYSTEM                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  User: "Search for hotels in Dubai on Booking.com"           │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ IQ Exchange Translation Layer                             │ │
│  │   → BROWSER action detected                               │ │
│  │   → Route to Playwright Bridge                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Playwright Bridge (bin/playwright-bridge.js)              │ │
│  │                                                           │ │
│  │  Commands:                                                │ │
│  │   navigate <url>          → Go to URL                     │ │
│  │   click <selector|text>   → Click element                 │ │
│  │   fill <selector> <text>  → Type in input                 │ │
│  │   type <text>             → Type at cursor                │ │
│  │   press <key>             → Press key (Enter, Tab, etc)   │ │
│  │   wait <selector> <ms>    → Wait for element              │ │
│  │   screenshot <file>       → Capture page                  │ │
│  │   content                 → Get page text                 │ │
│  │   elements                → List all elements             │ │
│  │   close                   → Close browser session         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Chromium Browser (Headless or Visible)                    │ │
│  │   • Persistent session across commands                    │ │
│  │   • Cookies & auth remembered                             │ │
│  │   • DevTools access for debugging                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Current State vs. Enhancement

| Feature | Current | Enhanced |
|---------|---------|----------|
| Session persistence | ✅ Basic | ✅ Full cookie/auth persistence |
| Element selection | Text/CSS only | Smart AI-assisted selector |
| Form filling | Manual fields | Auto-detect all form fields |
| Multi-tab | ❌ Single tab | ✅ Multiple tabs |
| Screenshots | ✅ Basic | ✅ With element annotations |
| DOM extraction | ❌ | ✅ Structured for AI analysis |

## Enhanced Playwright Bridge Commands

```javascript
// NEW: Smart element finding (AI-assisted)
node playwright-bridge.js smart-click "the search button"
node playwright-bridge.js smart-fill "email" "user@example.com"

// NEW: Element discovery for AI
node playwright-bridge.js list-interactive   // Lists all clickable/fillable elements
node playwright-bridge.js describe-page      // AI-friendly page description

// NEW: Multi-tab
node playwright-bridge.js new-tab
node playwright-bridge.js switch-tab 2
node playwright-bridge.js list-tabs

// NEW: Authentication helpers
node playwright-bridge.js save-cookies "site-name"
node playwright-bridge.js load-cookies "site-name"

// NEW: Form automation
node playwright-bridge.js auto-fill-form '{"email":"x","password":"y"}'
```

## Integration with IQ Exchange

```javascript
// In lib/iq-exchange.mjs - TASK_PATTERNS
browser: /\b(website|browser|search|navigate|booking\.com|amazon|google|fill.*form|click.*button|login|signup)\b/i

// Translation example:
// User: "Book a hotel in Dubai on Booking.com"
// IQ Exchange generates:
[
  'node playwright-bridge.js navigate "https://booking.com"',
  'node playwright-bridge.js wait "[name=ss]" 5000',
  'node playwright-bridge.js fill "[name=ss]" "Dubai hotels"', 
  'node playwright-bridge.js click "[type=submit]"',
  'node playwright-bridge.js screenshot "search-results.png"'
]
```

---

# 2. Browser Use System

## Purpose
Built-in browser panel inside Goose for:
1. **App Preview** - See your code rendered live
2. **Web Browsing** - AI can browse the web inside Goose
3. **Automation Control** - Visual feedback for Playwright actions

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    BROWSER USE SYSTEM                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ BUILT-IN BROWSER (Electron BrowserView)                   │ │
│  │                                                           │ │
│  │  ┌───────────────────────────────────────────────────┐   │ │
│  │  │ 🌐 https://localhost:5173    🔄 ◀ ▶ 🔍 🛠️ 📸      │   │ │
│  │  ├───────────────────────────────────────────────────┤   │ │
│  │  │                                                   │   │ │
│  │  │             YOUR APP RENDERS HERE                 │   │ │
│  │  │                                                   │   │ │
│  │  │     [Live preview of HTML/CSS/JS you write]      │   │ │
│  │  │                                                   │   │ │
│  │  │                                                   │   │ │
│  │  └───────────────────────────────────────────────────┘   │ │
│  │                                                           │ │
│  │  Toolbar:                                                 │ │
│  │   🔄 Refresh  ◀ Back  ▶ Forward  🔍 URL Bar              │ │
│  │   🛠️ DevTools  📸 Screenshot  📍 Element Inspect         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Modes:                                                        │
│   [Preview] - Shows your local app (default)                  │
│   [Browse]  - Navigate to any URL                             │
│   [Automate]- Watch Playwright actions in real-time           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Features

### Preview Mode (Vibe Coding)
```
User: "Make me a landing page"
  ↓
Goose writes HTML/CSS/JS
  ↓
Auto-starts Vite dev server (port 5173)
  ↓
Built-in browser loads http://localhost:5173
  ↓
User: "Make the header blue"
  ↓
Goose edits CSS → Hot reload → Preview updates instantly
```

### Browse Mode
```
User: "Go to GitHub and star the browser-use repo"
  ↓
Built-in browser navigates to github.com
  ↓
AI uses Playwright to interact with the page
  ↓
User can SEE every action happening
```

### Automate Mode (Visible Automation)
```
When Playwright runs:
  1. Built-in browser shows the exact page
  2. Red highlight appears on clicked elements
  3. Green highlight on filled inputs
  4. Status bar shows current action
```

## IPC Handlers (main.cjs)

```javascript
// Browser panel control
ipcMain.handle('browser:create-view', async (event, options) => {
    browserView = new BrowserView({ webPreferences });
    mainWindow.addBrowserView(browserView);
    return { success: true };
});

ipcMain.handle('browser:navigate', async (event, url) => {
    await browserView.webContents.loadURL(url);
    return { success: true, url };
});

ipcMain.handle('browser:screenshot', async () => {
    const image = await browserView.webContents.capturePage();
    return { success: true, base64: image.toDataURL() };
});

ipcMain.handle('browser:execute-js', async (event, script) => {
    const result = await browserView.webContents.executeJavaScript(script);
    return { success: true, result };
});

ipcMain.handle('browser:get-dom', async () => {
    const dom = await browserView.webContents.executeJavaScript(`
        Array.from(document.querySelectorAll('a, button, input, select, textarea'))
            .map(el => ({
                tag: el.tagName,
                text: el.textContent?.trim().slice(0, 50),
                id: el.id,
                name: el.name,
                type: el.type,
                placeholder: el.placeholder
            }))
    `);
    return { success: true, elements: dom };
});
```

---

# 3. Computer Use System

## Purpose
Control the Windows desktop - open apps, click UI elements, type text, take screenshots.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                   COMPUTER USE SYSTEM                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  User: "Open Spotify and play some jazz"                      │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ IQ Exchange Translation Layer                             │ │
│  │   → DESKTOP action detected                               │ │
│  │   → Route to Computer Use module                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                         ↓                                      │
│  ┌────────────────────────────────────┬─────────────────────┐ │
│  │ input.ps1 (PowerShell)             │ computer-use.cjs    │ │
│  │ (Current - 66KB!)                  │ (Node.js native)    │ │
│  │                                    │                     │ │
│  │ • UIAutomation via .NET            │ • robotjs for speed │ │
│  │ • OCR via Windows API              │ • screenshot-desktop│ │
│  │ • Window management                │ • Cross-platform    │ │
│  └────────────────────────────────────┴─────────────────────┘ │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Windows Desktop                                           │ │
│  │   • Apps, dialogs, menus                                  │ │
│  │   • Task bar, system tray                                 │ │
│  │   • Any visible UI element                                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Available Commands (input.ps1)

### Vision Commands (The Eyes)
```powershell
# See what's on screen
input.ps1 screenshot "screen.png"      # Capture full screen
input.ps1 ocr "full"                   # Read ALL text on screen
input.ps1 ocr "region" 100 100 500 400 # Read text in region
input.ps1 app_state "Notepad"          # Get UI tree of app (buttons, menus, etc.)
```

### Navigation Commands
```powershell
# Open and focus apps
input.ps1 open "Spotify"               # Launch or focus app
input.ps1 startmenu                    # Open Windows Start menu
input.ps1 focus "Save As"              # Focus specific dialog/element
input.ps1 waitfor "Ready" 10           # Wait for text to appear (max 10s)
```

### Interaction Commands (Smart - via UIAutomation)
```powershell
# Click by element name (RELIABLE!)
input.ps1 uiclick "Play"               # Click button named "Play"
input.ps1 uiclick "File"               # Click menu item
input.ps1 uipress "Remember me"        # Toggle checkbox
input.ps1 uipress "Jazz"               # Select list item

# Type text
input.ps1 type "Hello World"           # Type into focused element
input.ps1 keyboard "search query"      # Alternative typing method
input.ps1 key "Enter"                  # Press single key
input.ps1 hotkey "Ctrl+S"              # Key combination
```

### Fallback Commands (Coordinate-based)
```powershell
# When UIAutomation fails, use coordinates
input.ps1 mouse 500 300                # Move mouse to x,y
input.ps1 click                        # Click at current position
input.ps1 drag 100 100 500 500         # Drag from point to point
```

## Example Flow

```
User: "Open Paint and draw a red circle"

IQ Exchange generates:
1. input.ps1 open "Paint"
2. input.ps1 waitfor "Untitled" 5
3. input.ps1 uiclick "Brushes"
4. input.ps1 uiclick "Red"
5. input.ps1 mouse 400 300
6. input.ps1 drag 400 300 500 400

After each step:
  → Screenshot
  → OCR/app_state to verify
  → If failed → Self-heal and retry
```

## Enhancements Needed

| Current | Enhanced |
|---------|----------|
| PowerShell scripts (slow startup) | Node.js native with robotjs |
| Basic element finding | Smart element grounding with labels |
| Manual verification | Auto-screenshot after each action |
| English-only OCR | Multi-language OCR support |

---

# 4. Full Vision Capabilities

## Purpose
Let the AI "see" the screen like a human - understand what's visible, where elements are, and verify actions worked.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    VISION SYSTEM                               │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ SCREENSHOT LAYER                                          │ │
│  │   • Full screen capture                                   │ │
│  │   • Window-specific capture                               │ │
│  │   • Region capture                                        │ │
│  │   • Before/after comparison                               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ANALYSIS LAYER                                            │ │
│  │                                                           │ │
│  │  ┌────────────────┬────────────────┬──────────────────┐  │ │
│  │  │ OCR Engine     │ UI Automation  │ AI Vision (LLM)  │  │ │
│  │  │                │                │                  │  │ │
│  │  │ • Read text    │ • Element tree │ • Understand     │  │ │
│  │  │ • Find words   │ • Button names │   context        │  │ │
│  │  │ • Coordinates  │ • Input fields │ • Verify success │  │ │
│  │  │   of text      │ • Menus        │ • Describe scene │  │ │
│  │  └────────────────┴────────────────┴──────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ GROUNDING LAYER (Element Labeling)                        │ │
│  │                                                           │ │
│  │  Screenshot with overlays:                                │ │
│  │  ┌─────────────────────────────────────────┐             │ │
│  │  │   [1] File   [2] Edit   [3] View        │             │ │
│  │  │   ┌─────────────────────────────┐       │             │ │
│  │  │   │ [4] Search...               │       │             │ │
│  │  │   └─────────────────────────────┘       │             │ │
│  │  │                                         │             │ │
│  │  │   [5] Save   [6] Cancel                 │             │ │
│  │  └─────────────────────────────────────────┘             │ │
│  │                                                           │ │
│  │  AI can say: "Click element [5]" → We click Save button  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Vision Flow

### Before Action
```
1. Screenshot current state
2. OCR to find text locations
3. UIAutomation to get element names
4. Create "grounding map" of clickable elements
5. Send to AI: "Here's what I see on screen..."
```

### After Action
```
1. Screenshot new state
2. Compare with previous
3. OCR to verify expected text appeared
4. Send to AI: "Did the action succeed?"
5. If failed → Generate fix → Retry
```

## Grounding Map Example

```json
{
  "screenshot": "base64://...",
  "elements": [
    { "id": 1, "type": "button", "text": "File", "bounds": [10, 5, 50, 25] },
    { "id": 2, "type": "button", "text": "Edit", "bounds": [60, 5, 100, 25] },
    { "id": 3, "type": "input", "placeholder": "Search...", "bounds": [150, 50, 400, 80] },
    { "id": 4, "type": "button", "text": "Save", "bounds": [300, 500, 380, 530] },
    { "id": 5, "type": "button", "text": "Cancel", "bounds": [400, 500, 480, 530] }
  ],
  "ocr_text": [
    { "text": "Untitled - Notepad", "bounds": [100, 0, 300, 20] },
    { "text": "Hello World", "bounds": [50, 100, 200, 120] }
  ]
}
```

## AI Prompt with Vision

```
You are controlling a Windows computer. Here's what you see:

[SCREENSHOT: base64 image]

INTERACTIVE ELEMENTS:
[1] Button: "File" at (10, 5)
[2] Button: "Edit" at (60, 5)
[3] Input: "Search..." at (150, 50)
[4] Button: "Save" at (300, 500)
[5] Button: "Cancel" at (400, 500)

VISIBLE TEXT:
- "Untitled - Notepad" (title bar)
- "Hello World" (document content)

USER REQUEST: "Save this file as hello.txt"

YOUR ACTION:
- To click an element, say: CLICK [4]
- To type, say: TYPE "hello.txt"
- To press key, say: KEY Enter
```

---

# 5. Vibe Server Management

## Purpose
**"Vibe Server Management"** = Server tasks for people who don't know servers.

No SSH commands to memorize. Just tell Goose what you want in plain English.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                 VIBE SERVER MANAGEMENT                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  User: "My website is down, fix it"                           │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ IQ Exchange Translation Layer                             │ │
│  │   → SERVER action detected                                │ │
│  │   → Route to Server Management module                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ SERVER DIAGNOSIS FLOW                                     │ │
│  │                                                           │ │
│  │  1. Check if we have SSH credentials                      │ │
│  │     → If not: "I need SSH access. Enter credentials?"     │ │
│  │                                                           │ │
│  │  2. Connect to server                                     │ │
│  │     → ssh root@86.105.224.125                            │ │
│  │                                                           │ │
│  │  3. Diagnose the issue                                    │ │
│  │     → systemctl status nginx                              │ │
│  │     → pm2 status                                          │ │
│  │     → tail -n 50 /var/log/nginx/error.log                │ │
│  │                                                           │ │
│  │  4. Fix the issue                                         │ │
│  │     → systemctl restart nginx                             │ │
│  │     → pm2 restart all                                     │ │
│  │                                                           │ │
│  │  5. Verify fix worked                                     │ │
│  │     → curl http://localhost                               │ │
│  │     → Report back to user                                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Noob-Friendly Commands (What User Says → What Goose Does)

| User Says | Goose Does |
|-----------|------------|
| "Is my server running?" | `ssh` → `systemctl status nginx` → parse output |
| "Restart my website" | `pm2 restart all` or `systemctl restart nginx` |
| "Check the logs" | `tail -n 100 /var/log/nginx/error.log` |
| "Deploy my latest code" | `git pull` → `npm install` → `npm run build` → `pm2 restart` |
| "My server is slow" | Check CPU/memory, identify resource hogs |
| "Set up SSL" | `certbot --nginx -d domain.com` |
| "Add a new website" | Create nginx config, set up PM2 process |
| "Backup my database" | `pg_dump` or `mysqldump` |
| "My disk is full" | `df -h`, find large files, clean up safely |

## Server Panel UI

```
┌────────────────────────────────────────────────────────────────┐
│ 🔗 SERVER MANAGEMENT                                     [X]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌───────────────────────────────────────────────────────────┐│
│  │ CONNECTIONS                                    [+ Add New] ││
│  │ ─────────────────────────────────────────────────────────  ││
│  │ ● Production Server (86.105.224.125)           [Connect]  ││
│  │ ○ Staging Server (192.168.1.100)               [Connect]  ││
│  └───────────────────────────────────────────────────────────┘│
│                                                                │
│  ┌───────────────────────────────────────────────────────────┐│
│  │ QUICK ACTIONS                                              ││
│  │ ─────────────────────────────────────────────────────────  ││
│  │  [🔄 Restart Website]  [📊 Check Status]  [📋 View Logs]  ││
│  │  [🚀 Deploy Latest]    [💾 Backup DB]     [🔒 SSL Setup]  ││
│  └───────────────────────────────────────────────────────────┘│
│                                                                │
│  ┌───────────────────────────────────────────────────────────┐│
│  │ LIVE TERMINAL                                              ││
│  │ ─────────────────────────────────────────────────────────  ││
│  │ root@server:~# systemctl status nginx                     ││
│  │ ● nginx.service - A high performance web server           ││
│  │    Loaded: loaded (/lib/systemd/system/nginx.service)     ││
│  │    Active: active (running) since Mon 2025-12-16 10:00    ││
│  │                                                           ││
│  │ $> _                                                      ││
│  └───────────────────────────────────────────────────────────┘│
│                                                                │
│  ┌───────────────────────────────────────────────────────────┐│
│  │ 💬 ASK GOOSE (natural language)                           ││
│  │ ─────────────────────────────────────────────────────────  ││
│  │ "Why is my website slow?"                    [Ask Goose]  ││
│  └───────────────────────────────────────────────────────────┘│
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## SSH Service Implementation

```javascript
// services/SSHService.js
const { Client } = require('ssh2');

class SSHService {
    constructor() {
        this.connections = new Map();
    }

    async connect(name, config) {
        const conn = new Client();
        return new Promise((resolve, reject) => {
            conn.on('ready', () => {
                this.connections.set(name, conn);
                resolve({ success: true });
            });
            conn.on('error', reject);
            conn.connect(config);
        });
    }

    async exec(name, command) {
        const conn = this.connections.get(name);
        if (!conn) throw new Error('Not connected');
        
        return new Promise((resolve, reject) => {
            conn.exec(command, (err, stream) => {
                if (err) reject(err);
                let output = '';
                stream.on('data', (data) => output += data);
                stream.on('close', () => resolve(output));
            });
        });
    }

    // High-level helper methods
    async checkWebsiteStatus(name) {
        const nginx = await this.exec(name, 'systemctl is-active nginx');
        const pm2 = await this.exec(name, 'pm2 jlist');
        return { nginx: nginx.trim(), pm2: JSON.parse(pm2) };
    }

    async restartWebsite(name) {
        await this.exec(name, 'pm2 restart all');
        await this.exec(name, 'systemctl reload nginx');
        return { success: true };
    }

    async getLogs(name, lines = 50) {
        return this.exec(name, `tail -n ${lines} /var/log/nginx/error.log`);
    }

    async deploy(name, path = '/var/www/app') {
        await this.exec(name, `cd ${path} && git pull`);
        await this.exec(name, `cd ${path} && npm install`);
        await this.exec(name, `cd ${path} && npm run build`);
        await this.exec(name, 'pm2 restart all');
        return { success: true };
    }
}
```

## Saved Server Configurations

```json
// .opencode/servers.json
{
  "production": {
    "name": "Production Server",
    "host": "86.105.224.125",
    "port": 22,
    "username": "root",
    "authType": "password",
    "webRoot": "/var/www/myapp",
    "pm2App": "myapp"
  },
  "staging": {
    "name": "Staging Server",
    "host": "192.168.1.100",
    "port": 22,
    "username": "deploy",
    "authType": "key",
    "keyPath": "~/.ssh/id_rsa",
    "webRoot": "/var/www/staging"
  }
}
```

---

# Summary: All Five Subsystems

| Subsystem | Purpose | Key Tech |
|-----------|---------|----------|
| **1. Playwright** | Browser automation | Playwright + persistent sessions |
| **2. Browser Use** | Built-in browser panel | Electron BrowserView |
| **3. Computer Use** | Desktop automation | input.ps1 + UIAutomation |
| **4. Full Vision** | See and verify | OCR + Screenshot + Grounding |
| **5. Vibe Server** | Noob-friendly server ops | SSH2 + high-level helpers |

All subsystems connect through **IQ Exchange** which:
- Detects task type from natural language
- Routes to appropriate subsystem
- Executes with self-healing loop
- Verifies success using vision
- Retries until success or max attempts

---

*This document provides implementation-ready specifications for each core subsystem.*
