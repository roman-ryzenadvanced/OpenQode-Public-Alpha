# Native Electron Goose Integration

## Problem Statement
The `/goose` command in GEN5 TUI doesn't work properly because:
1. It requires Rust/Cargo to build Goose from source
2. It needs a Goose web server running on a custom port
3. The prerequisite detection blocks the launch

## Proposed Solution
Create a **true native Electron chat app** that:
- Doesn't require the Goose Rust backend at all
- Uses the existing Qwen OAuth directly from `qwen-oauth.mjs`
- Provides a standalone desktop chat interface
- Works immediately without prerequisites

---

## Proposed Changes

### Component: Electron App (`bin/goose-electron-app/`)

#### [MODIFY] main.cjs
Transform from a simple URL wrapper into a full native chat application:
- Create BrowserWindow with embedded chat UI
- Load a local HTML file instead of external URL
- Set up IPC communication for Qwen API calls

#### [NEW] preload.js
Context bridge for secure communication between renderer and main process

#### [NEW] index.html
Native chat UI with:
- Modern dark theme matching OpenQode aesthetic
- Message input with streaming display
- Code block rendering with syntax highlighting

#### [NEW] renderer.js
Client-side logic for chat interface

#### [NEW] styles.css
Premium dark theme styling

---

### Component: TUI Integration (`bin/opencode-ink.mjs`)

#### [MODIFY] opencode-ink.mjs
Update `/goose` command handler (around line 4140) to:
- Launch native Electron app directly without prerequisite checks
- Skip the Goose web backend entirely
- Use the new native chat implementation

---

### Component: Qwen API Bridge

#### [NEW] qwen-bridge.cjs
Main process module that:
- Imports `qwen-oauth.mjs` for authentication
- Handles API calls to Qwen
- Streams responses back to renderer via IPC

---

## Verification Plan

### Automated Tests
1. Launch TUI: `node --experimental-require-module bin\opencode-ink.mjs`
2. Type `/goose` command
3. Verify Electron window opens
4. Send a test message
5. Verify response streams correctly

### Manual Verification
1. Start OpenQode launcher → Select GEN5 TUI (option #2)
2. Type `/goose` and press Enter
3. Confirm native Electron chat window appears
4. Test sending messages and receiving AI responses
5. Verify window closes properly

---

## Dependencies
- Electron (already in `goose-electron-app/package.json`)
- Existing `qwen-oauth.mjs` for authentication

## Risk Assessment
- **Low risk**: Changes are isolated to the Goose integration
- **Reversible**: Original web-based flow can be kept as `/goose web` fallback
