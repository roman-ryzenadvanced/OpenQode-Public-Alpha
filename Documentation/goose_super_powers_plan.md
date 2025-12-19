# Goose Super Powers - Implementation Plan

## Vision
Transform Goose into a **Super-Powered AI Coding IDE** that beats Lovable and computer-use gimmicks by integrating:

1. **App Preview** - Live preview of web apps (like Antigravity)
2. **Computer Use** - Control Windows via GUI automation (Windows-Use)
3. **Browser Control** - Automated web browsing (browser-use)
4. **Server Management** - Remote server control via SSH

---

## Phase 1: App Preview (Priority: HIGH)

### Goal
Embed a live web browser/iframe in Goose that can preview HTML/JS/CSS files created by the AI.

### Implementation

#### [NEW] `bin/goose-electron-app/preview-panel.js`
- Create a preview panel component using Electron's BrowserView/webview
- Hot-reload when files change
- Support for file:// and localhost URLs
- Dev server integration (auto-run npm/vite when needed)

#### [MODIFY] `bin/goose-electron-app/index.html`
- Add resizable split-pane layout
- Preview panel on the right side
- Toggle button in header

#### [MODIFY] `bin/goose-electron-app/main.cjs`
- IPC handlers for:
  - `preview:load-url` - Load URL in preview
  - `preview:load-file` - Load HTML file
  - `preview:start-server` - Auto-start dev server
  - `preview:refresh` - Refresh preview

---

## Phase 2: Computer Use Integration (Priority: HIGH)

### Goal
Allow Goose to control the Windows desktop - click, type, take screenshots, execute commands.

### Key Features from Windows-Use/Open-Interface
- Screenshot capture and analysis
- Mouse/keyboard simulation
- Window management (minimize, focus, resize)
- Shell command execution
- UI Automation via accessibility APIs

### Implementation

#### [NEW] `bin/goose-electron-app/computer-use.cjs`
Module to handle computer control:
- `captureScreen()` - Take screenshot of desktop/window
- `click(x, y)` - Simulate mouse click
- `type(text)` - Simulate keyboard input
- `pressKey(key, modifiers)` - Key combinations (Ctrl+C, etc.)
- `moveWindow(title, x, y, w, h)` - Window management
- `runCommand(cmd)` - Execute shell commands
- `getActiveWindow()` - Get focused window info

#### Dependencies
- `robotjs` or `nut.js` - Cross-platform mouse/keyboard automation
- `screenshot-desktop` - Screen capture
- Native Node.js `child_process` for shell commands

#### [MODIFY] `bin/goose-electron-app/main.cjs`
Add IPC handlers:
- `computer:screenshot`
- `computer:click`
- `computer:type`
- `computer:run-command`
- `computer:get-windows`

#### [MODIFY] `bin/goose-electron-app/preload.js`
Expose computer-use APIs to renderer

---

## Phase 3: Browser Automation (Priority: MEDIUM)

### Goal
Allow Goose to browse the web autonomously - open pages, fill forms, click buttons, extract data.

### Key Features from browser-use
- Headless/headed browser control
- Page navigation
- Element interaction (click, type, select)
- Data extraction
- Form filling
- Screenshot of web pages

### Implementation

#### [NEW] `bin/goose-electron-app/browser-agent.cjs`
Browser automation using Playwright:
- `openPage(url)` - Navigate to URL
- `clickElement(selector)` - Click on element
- `typeInElement(selector, text)` - Type in input
- `extractText(selector)` - Get text content
- `screenshot()` - Capture page
- `evaluate(script)` - Run JS in page context

#### Dependencies
- `playwright` - Chromium automation (more reliable than Puppeteer)

---

## Phase 4: Server Management (Priority: MEDIUM)

### Goal
Allow Goose to connect to and manage remote servers via SSH.

### Features
- SSH connection management
- Remote command execution
- File upload/download (SFTP)
- Log viewing
- Service management (start/stop/restart)

### Implementation

#### [NEW] `bin/goose-electron-app/server-manager.cjs`
SSH and server management:
- `connect(host, user, keyPath)` - Establish SSH connection
- `exec(command)` - Run remote command
- `upload(localPath, remotePath)` - SFTP upload
- `download(remotePath, localPath)` - SFTP download
- `listProcesses()` - Get running processes
- `tailLog(path)` - Stream log file

#### Dependencies
- `ssh2` - SSH client for Node.js

---

## Phase 5: AI Agent Integration

### Goal
Connect all these capabilities to the AI so it can:
1. Understand user requests
2. Plan multi-step actions
3. Execute using computer-use/browser/server APIs
4. Verify results via screenshots
5. Self-correct if needed

### Implementation

#### [MODIFY] `bin/qwen-bridge.mjs`
Add tool definitions for the AI:
```javascript
const TOOLS = [
  {
    name: 'computer_screenshot',
    description: 'Take a screenshot of the desktop',
    parameters: {}
  },
  {
    name: 'computer_click',
    description: 'Click at screen coordinates',
    parameters: { x: 'number', y: 'number' }
  },
  {
    name: 'browser_open',
    description: 'Open a URL in the browser',
    parameters: { url: 'string' }
  },
  {
    name: 'run_command',
    description: 'Execute a shell command',
    parameters: { command: 'string' }
  },
  // ... more tools
];
```

---

## UI Enhancements

### New Header Action Buttons
- 🖼️ **Preview** - Toggle app preview panel
- 🖥️ **Computer** - Show computer-use actions
- 🌐 **Browser** - Browser automation panel
- 🔗 **Server** - Server connection manager

### Action Modals
- Computer Use modal with screenshot display
- Browser automation with page preview
- Server terminal with command history

---

## Verification Plan

### Phase 1 Testing
1. Create an HTML file via chat
2. Click Preview button
3. Verify file renders in preview panel

### Phase 2 Testing
1. Ask "open notepad"
2. Verify Goose takes screenshot, finds notepad, clicks
3. Ask "type hello world"
4. Verify text appears in notepad

### Phase 3 Testing
1. Ask "go to google.com and search for weather"
2. Verify browser opens, navigates, searches

### Phase 4 Testing
1. Connect to SSH server
2. Run remote command
3. Verify output displayed

---

## Dependencies to Install

```bash
cd bin/goose-electron-app
npm install robotjs screenshot-desktop playwright ssh2
```

---

## Risk Assessment

- **robotjs** may require native build tools (node-gyp)
- **Playwright** downloads Chromium (~200MB)
- **SSH2** may have security implications (store credentials securely)

---

## Immediate Next Steps

1. **Start with App Preview** - Most impactful, lowest risk
2. Add preview panel to Electron app
3. Test with simple HTML file
4. Then add computer-use features
