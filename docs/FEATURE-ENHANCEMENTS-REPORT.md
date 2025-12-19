# OpenQode TUI QA + Enhancements Report

## What’s Verified Automatically (PASS)
- `npm test`
- `node --check bin/opencode-ink.mjs`
- Extension validation:
  - `node final_validation.js`
  - `node final_integration_test.js`
  - `node runtime_simulation_test.js`
  - `node validate_extension.js`

## Feature-by-Feature Status + Suggestions

### Desktop Automation (Start Menu / Clicks / UIA)
**Implemented**
- `bin/input.ps1` parses and core commands run (`key`, `click`, `uiclick`, `screenshot`, etc).
- Added `startmenu` command (`Ctrl+Esc`) to reliably open Start when `key LWIN` is flaky.

**Manual QA**
- From the TUI automation preview, run a plan that calls:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File "…/bin/input.ps1" startmenu`
  - Confirm Start opens consistently.

**Enhancements**
- Add a “foreground focus” step helper (bring shell/desktop to foreground before key presses).
- Add automatic retry strategy: `startmenu` → `uiclick "Start"` → coordinate fallback.

### IDE Loop (Explorer + Tabs + Open/Search + Context Pack)
**Implemented**
- Explorer sidebar toggle: `Ctrl+E`, `/explorer on|off` (default ON).
- Tabs UI: file preview tabs; `/open <path[:line]>`.
- Search overlay: `Ctrl+Shift+F`, `/search [query]` (ripgrep picker).
- Context pack: selected explorer files are appended once to the next prompt then cleared.
- Recent/Hot pickers: `Ctrl+R`/`Ctrl+H`, `/recent`, `/hot`.

**Manual QA**
- Toggle Explorer, select multiple files, send a prompt; selection clears and is used as context.
- `/search <term>` lists matches; Enter opens the match into tabs.

**Enhancements**
- Make Recent/Hot lists clickable directly in the sidebar (mouse-free “jump to”).
- Add “pin tab” and “reveal in explorer” actions in tabs.

### Diff Workflow (Git-Like Hunk Staging)
**Implemented**
- Hunk staging in diff view (toggle hunks; apply selected).
- Quick actions: apply, apply+reopen, apply+run tests.

**Enhancements**
- Add per-line staging inside hunks.
- Add “apply all + keep review open” for iterative editing.

### Quality Rails (Safe Mode + Confirm + Doctor)
**Implemented**
- `/safe on|off` guard rails for destructive runs and batches.
- Interactive Safe Confirm overlay (Enter run once, Esc cancel).
- `/doctor` environment diagnostics.

**Enhancements**
- Add “confirm all for this session” for repeated safe operations.
- Add a “dry-run” rendering for batches (expanded quoting + cwd).

### Task Wizard (`/new`)
**Implemented**
- `/new <goal>` seeds a checklist into the todo list; `Ctrl+T` opens tasks.

**Enhancements**
- Add “wizard phases” that map to Ask → Preview → Run → Verify with a progress ribbon.

### Project Intelligence (Index / Symbols / Recent / Hot)
**Implemented**
- `/index` builds `.opencode/index.json` (`rg --files` preferred).
- `/symbols [path]` basic symbol extraction.
- Recent/Hot tracking used by pickers.

**Enhancements**
- Add `/find <filename>` backed by index cache.
- Add lightweight “hot files” heuristics (recent churn + git status).

### Chat-to-App / Instant Preview / One-Click Deploy
**Implemented**
- `/app <name> <desc>` scaffolds an app into `web/apps/<name>`.
- `/preview [name]` runs local preview server.
- `/deployapp <name>` deploys via Vercel (requires `vercel` configured).

**Enhancements**
- Persist deploy history in `.opencode/deploy_history.json` and expose `/deploys`.

### Nano Dev (Self-Modify Safely, Fork-First)
**Implemented**
- `/nanodev <goal>` creates a worktree fork under `.opencode/nano-dev/*` and instructs AI to write only there.
- Helpers: `/nanodev status|diff|verify|cleanup`.
- Fixed startup crash by avoiding temporal-dead-zone behavior for `runNanoDevVerify`.

**Enhancements**
- Add `/nanodev merge` that produces a patch and applies it only after verify + clean git status.

### UI Polish (“Jaggy/Shaky” Feel)
**Implemented**
- Reduce motion toggle: `/motion on|off` (removes extra animated spinners to reduce redraw jitter).

**Enhancements**
- Add an FPS/terminal-capability section to `/doctor` to guide ideal terminal settings.

