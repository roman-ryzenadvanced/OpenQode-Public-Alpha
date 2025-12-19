# Goose Super - Built-In Tools Ecosystem

## Vision: Lovable + Antigravity Hybrid

**Goose Super should be a self-contained super-IDE where:**
- Everything happens INSIDE Goose (no external tools unless approved)
- Apps/pages are built, previewed, and tested within Goose's built-in browser
- AI sees everything and can interact with its own UI
- Users go from idea → working app → deployed in one session

---

## Core Principle: Built-In First

```
┌────────────────────────────────────────────────────────────────────┐
│                      GOOSE SUPER                                   │
│                                                                    │
│  User: "Build me a coffee shop website"                           │
│                              ↓                                     │
│  ┌─────────────────────┬─────────────────────┬─────────────────┐  │
│  │  📝 BUILT-IN EDITOR │  🌐 BUILT-IN BROWSER│  💬 AI CHAT     │  │
│  │  (Monaco/VS Code)   │  (Electron webview) │  (Qwen/Claude)  │  │
│  │                     │                     │                  │  │
│  │  - File tree        │  - Live preview     │  - Plan tasks    │  │
│  │  - Multi-tab        │  - Dev tools        │  - Execute       │  │
│  │  - Syntax highlight │  - Console output   │  - Verify        │  │
│  │  - IntelliSense     │  - Network monitor  │  - Self-correct  │  │
│  └─────────────────────┴─────────────────────┴─────────────────┘  │
│                              ↓                                     │
│  ┌─────────────────────┬─────────────────────┬─────────────────┐  │
│  │  🖥️ COMPUTER USE    │  🔗 SERVER MGMT     │  📦 PACKAGE MGR │  │
│  │  (Desktop control)  │  (SSH/Deploy)       │  (npm/pip/etc)  │  │
│  └─────────────────────┴─────────────────────┴─────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Complete Built-In Tools Matrix

### 🎨 **DEVELOPMENT TOOLS** (Always Use Built-In)

| Tool | Purpose | Implementation | External Fallback? |
|------|---------|----------------|-------------------|
| **Monaco Editor** | Code editing with IntelliSense | VS Code's Monaco (same core) | No - always built-in |
| **File Manager** | Create/edit/delete files/folders | Node.js fs operations | No - always built-in |
| **Terminal** | Run commands in project context | Node.js child_process | No - always built-in |
| **Git Panel** | Version control | isomorphic-git | Ask user for GitHub Desktop |
| **Package Manager** | Install dependencies | npm/yarn/pnpm via terminal | No - always built-in |
| **Live Preview** | See app in real-time | Electron BrowserView | No - always built-in |
| **Dev Server** | Hot-reload for React/Vue/etc | Vite built-in | No - always built-in |
| **Console** | View console.log output | Capture from BrowserView | No - always built-in |
| **Network Monitor** | See API calls | DevTools protocol | No - always built-in |

---

### 🌐 **BROWSER TOOLS** (Built-In Chromium)

| Tool | Purpose | Implementation |
|------|---------|----------------|
| **Built-In Browser** | Preview apps, browse web | Electron BrowserView (Chromium) |
| **DOM Inspector** | Inspect/modify elements | Chrome DevTools Protocol |
| **Screenshot** | Capture visible page | BrowserView.capturePage() |
| **Form Filler** | Auto-fill forms | DOM manipulation |
| **Navigation** | Forward/back/refresh | BrowserView methods |
| **Multi-Tab** | Multiple pages open | Multiple BrowserViews |
| **Cookie Manager** | Save/restore sessions | Electron session API |

**Browser Priority:**
```
1. Use BUILT-IN browser for preview and web actions
2. Only open EXTERNAL browser if:
   - User explicitly requests it ("open in Chrome")
   - Authentication flow requires it (OAuth callbacks)
   - Site blocks embedded browsers
   → Always ASK user first: "Need to open external browser for X. Approve?"
```

---

### 🖥️ **COMPUTER AUTOMATION** (Desktop Control)

| Tool | Purpose | Implementation |
|------|---------|----------------|
| **Screenshot** | Capture screen state | PowerShell/screencapture |
| **Element Finder** | Find UI elements by name (UIAutomation) | NEW - Windows Accessibility API |
| **Click** | Click at position or element | mouse_event / robotjs |
| **Type** | Keyboard input | SendKeys / robotjs |
| **Key Press** | Hotkeys (Ctrl+C, etc) | SendKeys / robotjs |
| **Window Manager** | Focus/minimize/move windows | WinAPI calls |
| **App Launcher** | Open applications | start / open / exec |
| **Clipboard** | Read/write clipboard | Electron clipboard API |

---

### 🔗 **SERVER & DEPLOYMENT** (Remote Operations)

| Tool | Purpose | Implementation | Ask User? |
|------|---------|----------------|-----------|
| **SSH Connect** | Connect to remote server | ssh2 library | Yes - show credentials dialog |
| **Remote Exec** | Run commands on server | ssh2 exec | No - once connected |
| **SFTP Upload** | Upload files to server | ssh2-sftp | No - once connected |
| **SFTP Download** | Download files from server | ssh2-sftp | No - once connected |
| **Log Stream** | Tail remote log files | ssh2 stream | No - once connected |
| **Docker** | Container management | SSH + docker commands | No |
| **PM2** | Process management | SSH + pm2 commands | No |

---

### 📦 **PROJECT SCAFFOLDING** (Templates)

| Template | Stack | Files Created |
|----------|-------|---------------|
| **Static Site** | HTML/CSS/JS | index.html, style.css, script.js |
| **React App** | Vite + React | Full Vite React setup |
| **Vue App** | Vite + Vue | Full Vite Vue setup |
| **Next.js** | Next.js | Full Next.js setup |
| **API Server** | Express | Express with routes |
| **Full-Stack** | Next.js + DB | Full-stack with Prisma |

---

## IDE Integration Strategy (VS Code Components)

### Option A: **Monaco Editor Only** (Recommended)
Use VS Code's Monaco editor component standalone:

```
What we take from VS Code:
├── monaco-editor           # The editor component
├── TextMate grammars       # Syntax highlighting  
├── Language services       # IntelliSense for JS/TS/CSS/HTML
└── Extension host          # (Optional) Support VS Code extensions
```

**Pros:** Lightweight, well-documented, npm package available
**Cons:** No built-in file tree, terminals, or panels

### Option B: **VS Code in Electron** (Heavy)
Embed full VS Code via code-server or similar:

```
What we embed:
├── Full VS Code UI
├── All extensions
├── Terminal
└── File explorer
```

**Pros:** Full IDE experience
**Cons:** 200MB+ size, complex integration, version conflicts

### **Recommendation: Option A with custom panels**

```javascript
// Our architecture
goose-electron-app/
├── panels/
│   ├── EditorPanel.js      // Monaco wrapper
│   ├── FileTreePanel.js    // Custom file explorer
│   ├── TerminalPanel.js    // xterm.js integration
│   ├── PreviewPanel.js     // BrowserView wrapper
│   ├── ChatPanel.js        // AI conversation
│   └── BrowserPanel.js     // Web browsing
├── services/
│   ├── LanguageService.js  // Monaco language features
│   ├── FileService.js      // File operations
│   ├── ProjectService.js   // Project management
│   └── DevServerService.js // Vite/webpack integration
```

---

## Goose Super Flow: User Story

### "Build me a landing page for a coffee shop"

```
Step 1: User types request
        ↓
Step 2: Goose creates project folder
        ↓
Step 3: Goose scaffolds HTML/CSS/JS files
        ├── Opens in BUILT-IN Editor (Monaco)
        └── Shows in BUILT-IN Preview (BrowserView)
        ↓
Step 4: Goose writes code, preview updates live
        ↓
Step 5: User: "Make the header sticky"
        ↓
Step 6: Goose edits CSS, preview shows change instantly
        ↓
Step 7: User: "Deploy to my server"
        ↓
Step 8: Goose: "I need SSH credentials. Connect now?"
        ├── User provides credentials
        └── Goose connects, uploads, restarts nginx
        ↓
Step 9: Goose: "Done! Live at http://your-server.com"
        └── Shows in BUILT-IN Browser
```

---

## External Tool Permission Flow

When Goose needs something external:

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ Goose needs to use an external tool                    │
│                                                             │
│  Tool: Google Chrome                                        │
│  Reason: OAuth login requires external browser              │
│                                                             │
│  [✓ Approve]  [✗ Deny]  [Always allow for OAuth]           │
└─────────────────────────────────────────────────────────────┘
```

**Permission Categories:**
1. **Always Built-In**: Editor, preview, terminal, file ops
2. **Ask Once**: SSH connections, API keys
3. **Ask Every Time**: External browser, external apps
4. **Never Without Approval**: Purchases, account actions

---

## Implementation Priority

### Week 1: Core Editor + Preview
- [ ] Monaco Editor integration
- [ ] File tree panel
- [ ] Live preview with BrowserView
- [ ] Hot reload via Vite

### Week 2: Browser Superpowers
- [ ] Built-in browser for web actions
- [ ] DOM inspection
- [ ] Screenshot capture from browser
- [ ] Multi-tab support

### Week 3: Smart Automation
- [ ] UIAutomation element finder
- [ ] Screenshot → verify → correct loop
- [ ] Better click/type reliability

### Week 4: Server & Deploy
- [ ] SSH connection panel
- [ ] SFTP file upload
- [ ] Remote command execution
- [ ] Log streaming

---

## Summary: What Makes Goose SUPER

| Capability | Current | Goal |
|------------|---------|------|
| **Editor** | ❌ None | ✅ Full Monaco IDE |
| **Preview** | ⚠️ Basic webview | ✅ Live hot-reload with dev tools |
| **Browser** | ⚠️ External only | ✅ Built-in Chromium |
| **Automation** | ⚠️ Blind clicking | ✅ Smart element discovery |
| **Server** | ❌ None | ✅ SSH/SFTP/Deploy |
| **Projects** | ❌ None | ✅ Save/load/scaffold |

**Goose Super = Lovable (vibe coding) + Antigravity (computer use) + VS Code (IDE) in one package.**
