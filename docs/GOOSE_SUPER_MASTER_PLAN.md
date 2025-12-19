# 🦆 GOOSE SUPER - MASTER PLAN

## Vision Statement

**Goose Super** = **Lovable** (vibe coding) + **Antigravity** (computer use) + **VS Code** (IDE) in one self-contained package.

> "Everything happens INSIDE Goose. No external tools unless user approves."

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          GOOSE SUPER UI                                    │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         TOP BAR                                       │  │
│  │  🏠 Home  │  📝 Editor  │  🌐 Preview  │  🖥️ Computer  │  🔗 Server  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─────────────────┬────────────────────────────────────────────────────┐  │
│  │   FILE TREE     │              MAIN WORKSPACE                        │  │
│  │                 │                                                    │  │
│  │  📁 my-project  │   ┌─────────────────┬─────────────────────────┐   │  │
│  │    📄 index.html│   │  MONACO EDITOR  │   LIVE PREVIEW          │   │  │
│  │    📄 style.css │   │                 │   (Built-in Browser)    │   │  │
│  │    📄 script.js │   │  [code here]    │   [renders app here]    │   │  │
│  │                 │   │                 │                          │   │  │
│  │                 │   └─────────────────┴─────────────────────────┘   │  │
│  │                 │                                                    │  │
│  │                 │   ┌────────────────────────────────────────────┐   │  │
│  │                 │   │  TERMINAL / AI CHAT                        │   │  │
│  │                 │   │  > npm run dev                             │   │  │
│  │                 │   │  🧠 IQ Exchange: Building coffee shop...   │   │  │
│  │                 │   └────────────────────────────────────────────┘   │  │
│  └─────────────────┴────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Systems

### 1. 🧠 IQ Exchange (The Brain)

**What it does:** Translates natural language → executable commands → self-heals on failure

```
User: "Open notepad and type hello"
        ↓
IQ Exchange Translation Layer
        ↓
[powershell input.ps1 open "Notepad"]
[powershell input.ps1 waitfor "Untitled" 5]
[powershell input.ps1 type "Hello"]
        ↓
Execute → Screenshot → Verify → Self-Correct if needed
```

**Current State:** ✅ Working in `lib/iq-exchange.mjs` (536 lines)
- Translation layer with task type detection
- Execution with retry loop (max 5 attempts)
- Self-healing prompts sent to AI on failure
- Supports: Browser (Playwright), Desktop (input.ps1), Shell commands

**Improvements Needed:**
| Gap | Fix |
|-----|-----|
| No visual verification | Add screenshot → OCR → compare after each action |
| Limited element finding | Add UIAutomation element discovery |
| Looping is basic | Enhance with success criteria detection |

---

### 2. 📝 Built-In IDE (Monaco Editor)

**Purpose:** Write, edit, and manage code without leaving Goose

**Features to Add:**
- **Monaco Editor** from VS Code (same core)
- **File Tree** sidebar with create/delete/rename
- **Multi-Tab** editing
- **Syntax Highlighting** for all languages
- **IntelliSense** for JS/TS/CSS/HTML
- **Live Error Detection** (red underlines)
- **Git Panel** for version control

**Integration:**
```javascript
// Install
npm install monaco-editor

// Embed in Electron
import * as monaco from 'monaco-editor';
const editor = monaco.editor.create(document.getElementById('editor'), {
    value: code,
    language: 'javascript',
    theme: 'vs-dark'
});
```

---

### 3. 🌐 Built-In Browser (Preview & Automation)

**Purpose:** Preview apps AND automate web tasks without external browsers

**Features:**
| Feature | Implementation |
|---------|----------------|
| Live Preview | Electron BrowserView (Chromium) |
| Hot Reload | Watch file changes → refresh |
| Dev Tools | Chrome DevTools Protocol |
| DOM Inspector | Expose element tree to AI |
| Multi-Tab | Multiple BrowserViews in tabs |
| Screenshot | `BrowserView.capturePage()` |

**Goose Always Uses Built-In Browser:**
```
1. AI generates HTML/CSS/JS
2. Files saved to project folder
3. Auto-starts Vite dev server
4. Preview loads in built-in browser
5. Changes appear instantly (hot reload)
```

**Only Ask User for External Browser When:**
- OAuth login requires real browser
- Site blocks embedded browsers
- User explicitly requests "open in Chrome"

---

### 4. 🖥️ Computer Use (Desktop Automation)

**Purpose:** Control Windows desktop - click, type, screenshot, etc.

**Current State:** ✅ Working in `computer-use.cjs` + `input.ps1`

**Tools Available:**
```powershell
# Vision (The Eyes)
input.ps1 app_state "Window Name"     # UI tree structure
input.ps1 ocr "full"                  # Read all text on screen
input.ps1 screenshot "file.png"       # Capture screen

# Navigation
input.ps1 open "App Name"             # Launch/focus app
input.ps1 waitfor "Text" 10           # Wait for text to appear
input.ps1 focus "Element"             # Focus element

# Interaction (Reliable via UIAutomation)
input.ps1 uiclick "Button Name"       # Click by name
input.ps1 uipress "Item Name"         # Toggle/select
input.ps1 type "Hello World"          # Type text
input.ps1 key "Enter"                 # Press key
input.ps1 hotkey "Ctrl+C"             # Key combo

# Fallback (Coordinates)
input.ps1 mouse 100 200               # Move mouse
input.ps1 click                       # Click at position
```

**Improvements Needed:**
- Replace PowerShell with native Node.js (`robotjs`/`nut.js`) for speed
- Add element grounding (label screenshot with clickable elements)
- Better OCR integration for finding text on screen

---

### 5. 🔗 Server Management (SSH/Deploy)

**Purpose:** Connect to remote servers, run commands, deploy apps

**Features to Add:**
```javascript
// Using ssh2 library
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    conn.exec('pm2 restart all', (err, stream) => {
        stream.on('data', (data) => console.log(data.toString()));
    });
});
conn.connect({
    host: '86.105.224.125',
    username: 'root',
    password: '***'
});
```

**UI Panel:**
- Saved connections list
- Command input with history
- Log stream viewer
- SFTP file browser

---

## Complete Tool Ecosystem

### Always Built-In (Never Ask)

| Tool | Purpose |
|------|---------|
| Monaco Editor | Code editing |
| File Manager | Create/edit/delete files |
| Terminal | Run commands |
| Live Preview | Show app in browser |
| Dev Server | Vite for hot reload |
| Console Output | Show logs |
| Screenshot | Capture for verification |

### Ask Once (Then Remember)

| Tool | When to Ask |
|------|-------------|
| SSH Connection | First time connecting to server |
| API Keys | First time using external API |
| Git Credentials | First time pushing to repo |

### Ask Every Time (Safety)

| Tool | Why |
|------|-----|
| External Browser | User might not want visible browser |
| System Settings | Prevent accidental changes |
| File Delete | Prevent data loss |
| Server Restart | Prevent downtime |

---

## IQ Exchange Flow (Enhanced)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     IQ EXCHANGE MAIN LOOP                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User Request: "Build me a coffee shop landing page"               │
│                            ↓                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ STEP 1: DETECT TASK TYPE                                     │   │
│  │   → [code, file, browser]                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            ↓                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ STEP 2: TRANSLATION LAYER                                    │   │
│  │   "Build landing page" →                                     │   │
│  │     • Create index.html                                      │   │
│  │     • Create style.css                                       │   │
│  │     • Create script.js                                       │   │
│  │     • Start dev server                                       │   │
│  │     • Open in preview                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            ↓                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ STEP 3: EXECUTE (with built-in tools)                        │   │
│  │   [FILE] Write index.html                                    │   │
│  │   [FILE] Write style.css                                     │   │
│  │   [FILE] Write script.js                                     │   │
│  │   [TERMINAL] npx vite                                        │   │
│  │   [PREVIEW] Load http://localhost:5173                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            ↓                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ STEP 4: VERIFY (screenshot + analyze)                        │   │
│  │   • Screenshot preview panel                                 │   │
│  │   • Send to AI: "Did this render correctly?"                 │   │
│  │   • If error detected → STEP 5                               │   │
│  │   • If success → COMPLETE                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            ↓                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ STEP 5: SELF-HEAL (if verification failed)                   │   │
│  │   • Analyze error                                            │   │
│  │   • Generate fix                                             │   │
│  │   • Re-execute                                               │   │
│  │   • Retry up to 5 times                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                            ↓                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ STEP 6: LOOP (for persistent tasks)                          │   │
│  │   • Continue until user says stop                            │   │
│  │   • Or until success criteria met                            │   │
│  │   • Keep chat context for follow-ups                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Session & Project Management

### Home Screen (First Thing User Sees)

```
┌──────────────────────────────────────────────────────────────┐
│  🦆 GOOSE SUPER                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  RECENT PROJECTS                              [+ New Project]│
│  ───────────────────────────────────────────────────────────│
│  📁 Coffee Shop Landing    Last edited: 2 hours ago  [Open] │
│  📁 Dashboard App          Last edited: Yesterday    [Open] │
│  📁 API Server             Last edited: 3 days ago   [Open] │
│                                                              │
│  RECENT SESSIONS                            [View All]       │
│  ───────────────────────────────────────────────────────────│
│  💬 "Build landing page"   Dec 16, 3:30 PM           [Load] │
│  💬 "Fix login bug"        Dec 15, 10:00 AM          [Load] │
│  💬 "Server setup help"    Dec 14, 5:00 PM           [Load] │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Task Tracker (During Coding)

```
┌──────────────────────────────────────────────────────────────┐
│  ✅ TASK TRACKER                                        [X]  │
├──────────────────────────────────────────────────────────────┤
│  Current Goal: "Build coffee shop landing page"             │
│  ─────────────────────────────────────────────────          │
│  [x] Create project folder                                  │
│  [x] Write index.html structure                             │
│  [/] Style with CSS (in progress...)                        │
│  [ ] Add JavaScript interactions                            │
│  [ ] Test responsiveness                                    │
│                                                              │
│  [Save Progress]  [Clear Completed]  [+ Add Task]           │
└──────────────────────────────────────────────────────────────┘
```

### Data Storage

```javascript
// .opencode/projects.json - All projects
{
  "projects": [
    {
      "id": "proj_001",
      "name": "Coffee Shop Landing",
      "path": "E:/Projects/coffee-shop",
      "lastOpened": "2024-12-16T14:30:00Z",
      "files": ["index.html", "style.css", "script.js"]
    }
  ]
}

// .opencode/sessions/session_001.json - Chat sessions
{
  "id": "session_001",
  "title": "Build landing page",
  "created": "2024-12-16T14:30:00Z",
  "projectId": "proj_001",
  "messages": [...],
  "tasks": [
    { "text": "Create index.html", "done": true },
    { "text": "Style with CSS", "done": false }
  ]
}
```

---

## Implementation Phases

### Phase 0: Critical Fixes (FIRST - Before New Features)

> ⚠️ These are existing bugs that must be fixed before adding new capabilities

| Task | Effort | Priority |
|------|--------|----------|
| **2. Fix internal file save + preview pipeline** | 2 hours | 🔴 CRITICAL |
| **3. Fix layout squeeze and panel overlap** | 2 hours | 🔴 CRITICAL |
| **4. Repair IQ Exchange and action loop** | 3 hours | 🔴 CRITICAL |
| **5. Restore TODO/checklist sidebar + animations** | 2 hours | 🔴 CRITICAL |
| **6. Verify Playwright/browser automation flows** | 2 hours | 🔴 CRITICAL |
| **7. Run smoke tests and document results** | 1 hour | 🔴 CRITICAL |

**Details:**

0. **Internal File Save + Preview Pipeline**
   - Fix file write operations in `main.cjs`
   - Ensure saved files trigger preview refresh
   - Verify hot-reload works with Vite/dev server
   - Test create → save → preview flow end-to-end

1. **Layout Squeeze & Panel Overlap**
   - Fix CSS flexbox/grid issues in `styles.css`
   - Ensure panels resize correctly
   - Test all panel combinations

2. **IQ Exchange & Action Loop**
   - Debug `lib/iq-exchange.mjs` translation layer
   - Fix action execution in `renderer.js`
   - Verify self-healing retry loop works

3. **TODO/Checklist Sidebar**
   - Restore sidebar visibility
   - Add smooth slide animations
   - Persist tasks to session

4. **Playwright/Browser Automation**
   - Test all `playwright-bridge.js` commands
   - Verify session persistence
   - Fix any broken selectors

5. **Smoke Tests**
   - Run full QA checklist
   - Document pass/fail in `tests/SMOKE_TEST_RESULTS.md`
   - Fix any critical failures

### ⚡ Optimized Phase 0 Execution Strategy (Batching)

> **Goal:** Complete typical 12-hour work in ~6 hours by grouping related file edits.

| Batch | Tasks Covered | Files Touched |
|-------|---------------|---------------|
| **BATCH 1** | #2 (Save), #3 (Layout), #5 (Sidebar) | `renderer.js`, `styles.css`, `main.cjs` |
| **BATCH 2** | #4 (IQ Loop) | `lib/iq-exchange.mjs`, `renderer.js` |
| **BATCH 3** | #6 (Playwright), #7 (Smoke Tests) | `playwright-bridge.js`, `tests/*` |

---

## Safety & Telemetry (Critical Protocol)

1.  **🛑 Global STOP Button**: Must be visible in the UI at all times. Clicking it immediately kills `input.ps1` and Playwright processes.
2.  **🔒 Safe Mode**: Computer Use defaults to "Ask for Confirmation" before every click. Includes toggle to switch to "**AUTO ACCEPT**" mode for trusted sessions.
3.  **📝 Log Panel**: A minimal log viewer must be added to the bottom panel to debug "silent" failures.
    - **Smart Error Handling**: Any error log must include an "**IQ Exchange**" button. Clicking it sends the error context back to the AI with a prompt to analyze, generate a fix, and self-heal.

---

### Phase 1: Core IDE Experience (Week 1-2)

| Task | Effort | Priority |
|------|--------|----------|
| Monaco Editor integration | 6 hours | 🔴 CRITICAL |
| File tree panel | 4 hours | 🔴 CRITICAL |
| Multi-tab editing | 3 hours | 🔴 CRITICAL |
| Live preview with hot reload | 4 hours | 🔴 CRITICAL |
| Project save/load | 2 hours | 🟠 HIGH |
| Template scaffolding | 2 hours | 🟠 HIGH |

### Phase 2: Enhanced IQ Exchange (Week 2-3)

| Task | Effort | Priority |
|------|--------|----------|
| Screenshot verification loop | 3 hours | 🔴 CRITICAL |
| UIAutomation element finder | 4 hours | 🔴 CRITICAL |
| Success criteria detection | 2 hours | 🟠 HIGH |
| Better looping logic | 2 hours | 🟠 HIGH |
| Native Node.js automation (robotjs) | 4 hours | 🟡 MEDIUM |

### Phase 3: Built-In Browser (Week 3-4)

| Task | Effort | Priority |
|------|--------|----------|
| Multi-tab BrowserView | 4 hours | 🟠 HIGH |
| DOM inspector for AI | 3 hours | 🟠 HIGH |
| Dev tools integration | 3 hours | 🟡 MEDIUM |
| Network monitor | 2 hours | 🟡 MEDIUM |

### Phase 4: Server & Deploy (Week 4-5)

| Task | Effort | Priority |
|------|--------|----------|
| SSH connection panel | 4 hours | 🟠 HIGH |
| Remote command execution | 2 hours | 🟠 HIGH |
| SFTP file transfer | 3 hours | 🟡 MEDIUM |
| Log streaming | 2 hours | 🟡 MEDIUM |

### Phase 5: Polish & UX (Week 5-6)

| Task | Effort | Priority |
|------|--------|----------|
| Onboarding wizard | 3 hours | 🟡 MEDIUM |
| Modularize renderer.js | 4 hours | 🟡 MEDIUM |
| Visual polish (dark mode, animations) | 4 hours | 🟡 MEDIUM |
| Error recovery UI | 2 hours | 🟡 MEDIUM |

---

## File Changes Summary

### New Files to Create

```
bin/goose-electron-app/
├── panels/
│   ├── EditorPanel.js       # Monaco wrapper
│   ├── FileTreePanel.js     # Project file browser
│   ├── PreviewPanel.js      # BrowserView wrapper
│   ├── TerminalPanel.js     # xterm.js terminal
│   ├── BrowserPanel.js      # Web browsing (separate from preview)
│   └── ServerPanel.js       # SSH/deployment UI
├── services/
│   ├── ProjectService.js    # Save/load projects
│   ├── DevServerService.js  # Vite integration
│   ├── SSHService.js        # SSH connections
│   └── VerificationService.js # Screenshot → analyze loop
└── components/
    ├── OnboardingWizard.js  # First-run setup
    └── PermissionDialog.js  # External tool approval
```

### Files to Modify

| File | Changes |
|------|---------|
| `main.cjs` | Add IPC handlers for new services |
| `renderer.js` | Refactor into modular panels |
| `preload.js` | Expose new APIs to renderer |
| `index.html` | Add panel containers, tabs |
| `styles.css` | Panel layouts, dark theme polish |
| `lib/iq-exchange.mjs` | Enhance with verification loop |
| `computer-use.cjs` | Add UIAutomation element finder |

### Dependencies to Add

```json
{
  "dependencies": {
    "monaco-editor": "^0.45.0",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "ssh2": "^1.15.0",
    "isomorphic-git": "^1.25.0",
    "robotjs": "^0.6.0"
  }
}
```

---

## Verification Plan

### Automated Tests
```bash
# Run existing tests
npm test

# Add new tests for:
# - File operations
# - Project save/load
# - IQ Exchange translation
# - Screenshot capture
```

### Manual Testing Checklist

1. **Editor Test**
   - Create new project
   - Write HTML/CSS/JS
   - See live preview update

2. **IQ Exchange Test**
   - Say "open notepad"
   - Verify it opens
   - Say "type hello world"
   - Verify text appears

3. **Browser Test**
   - Navigate to google.com in built-in browser
   - Search for "weather"
   - Verify results appear

4. **Server Test**
   - Connect via SSH
   - Run `ls -la`
   - Verify output shows

---

## Questions for User Approval

1. **Start with Phase 1?** (Monaco Editor + File Tree + Preview)
2. **Skip any phases?** (Maybe delay Server/SSH if not needed)
3. **Specific LLMs?** (Keep Qwen only or add OpenAI/Claude?)
4. **Design preferences?** (Specific colors, layouts?)
5. **Priority features?** (What to do first if time is limited?)

---

## Summary

**Goose Super will become a self-contained AI coding powerhouse that:**

✅ Writes code in a full IDE (Monaco Editor)  
✅ Previews apps instantly (Built-in Browser)  
✅ Controls the desktop intelligently (IQ Exchange + UIAutomation)  
✅ Deploys to servers (SSH/SFTP)  
✅ Self-heals on errors (Translation Layer + Looping)  
✅ Never uses external tools without permission  

**Total estimated effort: ~60 hours over 6 weeks**

---

*Ready for your approval to begin execution.*
