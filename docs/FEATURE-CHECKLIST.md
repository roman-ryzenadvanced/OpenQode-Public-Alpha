# OpenQode TUI Feature Checklist (QA)

Statuses:
- `OK`: verified via automated/static checks in this repo
- `PARTIAL`: implemented, but needs manual QA in a real terminal session
- `TODO`: not implemented yet

## Automated Sanity (OK)
- `node --check bin/opencode-ink.mjs`
- `npm test`
- Extension validation:
  - `node final_validation.js`
  - `node final_integration_test.js`
  - `node runtime_simulation_test.js`
  - `node validate_extension.js`

## Startup / Core Flow
- TUI start (`npm start`) — `PARTIAL` (manual: confirm no crash in an interactive terminal)
- Project picker — `PARTIAL` (manual: pick current/recent/new path)
- Agent picker (`/agents`) — `PARTIAL`

## Layout / Smoothness
- Responsive sizing (`bin/tui-layout.mjs`) — `OK` (tests)
- Reduced jitter streaming (`bin/tui-stream-buffer.mjs`) — `PARTIAL` (manual: long response should not “shake”)
- Fixed/reserved strip heights (header/run/flow/footer/input) — `PARTIAL` (manual: transcript shouldn’t jump)
- Reduce motion toggle (`/motion on|off`) — `PARTIAL` (manual: fewer spinners/less jitter)

## Sidebar + IDE Loop
- Explorer sidebar (default ON) — `PARTIAL`
  - Toggle: `Ctrl+E`, `/explorer on|off`
  - Navigate: arrows, `Enter` open, `Space` select
- Preview tabs panel (`bin/ui/components/FilePreviewTabs.mjs`) — `PARTIAL`
  - `/open <path[:line]>` opens into tabs
- Project search (`/search [query]`) — `PARTIAL` (requires `rg` in PATH)
- Recent/Hot pickers — `PARTIAL`
  - `/recent`, `/hot`
  - `Ctrl+R` (recent), `Ctrl+H` (hot)
- “Add to context” pack from explorer selection — `PARTIAL`
- Persistent UI prefs (`.opencode/ui_prefs.json`) — `PARTIAL`

## Commands / Tools
- Command palette (`Ctrl+P`, `Ctrl+K`, `/settings`) — `PARTIAL`
- Safe mode (`/safe on|off`) — `PARTIAL`
- Safe confirm overlay (Enter run once, Esc cancel) — `PARTIAL`
- `/doctor` diagnostics — `PARTIAL`
- Task Wizard (`/new <goal>`) — `PARTIAL`

## File Writes / Diff Review
- Pending file diffs + `/write` — `PARTIAL`
- Diff review overlay — `PARTIAL`
- Hunk staging / partial apply — `PARTIAL`
- Apply + reopen / apply + run tests actions — `PARTIAL`

## Automation (IQ Exchange)
- Request → plan preview → run (`PreviewPlan` / `AutomationTimeline`) — `PARTIAL`
- Step-by-step gate + step editor — `PARTIAL`
- Inspector panels (Browser/Desktop/Server) — `PARTIAL`
- Desktop automation script parsing + basic commands — `OK`
  - `powershell -NoProfile -ExecutionPolicy Bypass -File bin/input.ps1 key LWIN`
  - `powershell -NoProfile -ExecutionPolicy Bypass -File bin/input.ps1 startmenu`

## Project Intelligence
- Index cache (`/index`, `.opencode/index.json`) — `PARTIAL`
- Symbols map (`/symbols`) — `PARTIAL`
- Recent/Hot tracking — `PARTIAL`

## Nano Dev (Self-Improve Safely)
- Nano Dev fork workflow (`/nanodev <goal>`) — `PARTIAL`
- Fork verify (`/nanodev verify`) — `PARTIAL`

