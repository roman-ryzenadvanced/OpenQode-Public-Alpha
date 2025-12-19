# OpenQode Gen5 — Feature QA Checklist + Enhancements

This report is **code-level QA** (feature existence + wiring + tests + sanity guards). It does **not** replace manual runtime QA in a real terminal session (especially for Windows UI Automation + browser popups).

Last updated: 2025-12-15

## Legend
- ✅ Implemented + wired + basic automated checks pass
- 🟡 Implemented but requires manual runtime verification
- 🔴 Missing / incomplete (recommended next work)

---

## 1) Core TUI Shell (Layout, Stability, UX)
- ✅ Split-pane layout with responsive sidebar (`bin/opencode-ink.mjs`)
- ✅ Reduced resize “shake” via debounced terminal sizing (`bin/opencode-ink.mjs`)
- 🟡 Resize jitter may still occur depending on terminal renderer and font; verify in Windows Terminal + cmd + PowerShell

Enhancements
- Add layout hysteresis near breakpoint boundaries (prevents mode flapping during resize).
- Add `/motion on|off` to a visible toggle in Settings/Palette (already exists as command).

---

## 2) Sidebar + Explorer (IDE-style File Manager)
- ✅ Explorer tree component (`bin/ui/components/FileTree.mjs`)
- ✅ Sidebar rendering + selection wiring (`bin/ui/components/PremiumSidebar.mjs`, `bin/opencode-ink.mjs`)
- ✅ Reveal controls:
  - `Ctrl+E` toggles Explorer
  - `/explorer on|off`
- ✅ Selected files become a “context pack” for the next prompt (`bin/opencode-ink.mjs`)
- 🟡 Manual QA: ensure Explorer appears in narrow mode (Tab to expand sidebar, `Ctrl+E` should expand/focus)

Enhancements
- Add a dedicated “Explorer focus mode” hotkey (e.g. `Ctrl+Shift+E`) to jump into tree navigation.
- Add file actions: rename/delete/new file (safe-mode gated).

---

## 3) File Preview Tabs + Open/Search
- ✅ File tabs UI (`bin/ui/components/FilePreviewTabs.mjs`)
- ✅ `/open <path[:line]>` opens a file tab (`bin/opencode-ink.mjs`)
- ✅ `/search <rg query>` + search overlay (`bin/ui/components/SearchOverlay.mjs`, `bin/opencode-ink.mjs`)
- ✅ Recent/Hot file pickers (`Ctrl+R`, `Ctrl+H`) + tracking (`bin/opencode-ink.mjs`)
- 🟡 Manual QA: open → edit → reopen behavior with large files

Enhancements
- Add “pin tab” + “close others” actions.
- Add symbol/outline panel (basic parsing for JS/TS/Python).

---

## 4) Better Edit Workflow (Diff + Hunks + One-Key Actions)
- ✅ Diff viewer with hunk toggles + apply actions (`bin/ui/components/DiffView.mjs`)
  - `TAB` toggles diff/hunks
  - `T` toggles hunk, `A` all, `X` none
  - `R` apply + reopen, `V` apply + run tests
- 🟡 Manual QA: ensure apply writes correct files and doesn’t mangle newlines

Enhancements
- Add “stage to git” (interactive `git add -p`) integration with safe-mode prompts.

---

## 5) Guided “Task Wizard” (`/new`)
- ✅ `/new <goal>` seeds a checklist into Tasks (`Ctrl+T`) (`bin/opencode-ink.mjs`)
- 🟡 Manual QA: tasks persist per-project and render correctly in overlay

Enhancements
- Add “run next step” action that triggers `/search`, `/open`, test runs, etc.

---

## 6) Quality Rails (Safe Mode, Verify Step, Doctor)
- ✅ Safe mode (`/safe on|off`) for destructive command blocking (`bin/opencode-ink.mjs`)
- ✅ `/doctor` diagnostics for terminal + tools + preview server state (`bin/opencode-ink.mjs`)
- ✅ Automation plans auto-append lightweight verify steps for browser flows (`bin/opencode-ink.mjs`)

Enhancements
- Add “safe-mode confirmations” UI in preview plan (show WHY a step is risky).

---

## 7) Chat-to-App + Instant Preview + Deploy
- ✅ Chat-to-App scaffold writes vanilla app to `web/apps/<name>` (`bin/opencode-ink.mjs`)
- ✅ Preview server start/stop + browser open (`/preview`) (`bin/opencode-ink.mjs`)
- ✅ One-click deploy:
  - `/deploy` deploys current project to Vercel
  - `/deployapp <name>` deploys a generated app dir (`bin/opencode-ink.mjs`)
- 🟡 Manual QA: verify `server.js` exists and preview server serves expected routes

Enhancements
- Add per-app “deploy pipeline” UI card with last deploy URL + logs.

---

## 8) IQ Exchange (Computer Use / Browser Use / Server Management)
- ✅ Request detection + routing (`lib/iq-exchange.mjs`, `bin/opencode-ink.mjs`)
- ✅ Empty-plan/stuck-state guards (no “0 steps” preview; clears preview state on translation failure)
- ✅ Browser routing improvements to prefer Playwright (reduces Edge first-run popups breaking flows)
- ✅ Playwright popup dismissal best-effort (`bin/playwright-bridge.js`)
- ✅ “Vision-like” auto-observations for self-heal (DOM content + OCR + window lists) on failures (`bin/opencode-ink.mjs`)
- 🟡 Manual QA: Edge popups + Windows Start menu automation on your machine

Enhancements
- Add a “preflight” step library the translator can reference (focus checks, window activation, retries).
- Add an internal “failure classifier” (timeouts vs focus vs popup vs permission) to drive more reliable retries.

---

## 9) Nano Dev (Self-modifying TUI on a fork/worktree)
- ✅ `/nanodev <goal>` creates a git worktree fork under `.opencode/nano-dev/*` (`bin/opencode-ink.mjs`)
- ✅ Auto-verify after writes land in fork (runs `node --check` + `npm test`)
- ✅ Fix for verify init crash by moving verifier out of component scope (`bin/opencode-ink.mjs`)
- 🟡 Manual QA: requires git repo state suitable for worktrees

Enhancements
- Add `/nanodev merge` flow (safe-mode gated, with “diff preview” first).

---

## 10) Goose “Windows App” Launch (Lovable/Vibe Coding Companion)
Goal: launch Goose from the TUI while using the **same Qwen auth** as OpenQode.

- ✅ Local OpenAI-compatible proxy backed by Qwen CLI (`bin/qwen-openai-proxy.mjs`)
  - Supports `/v1/chat/completions` (stream/non-stream) and `/v1/models`
- ✅ Goose launcher that:
  - starts proxy if needed
  - launches `goose web` using the proxy (`bin/goose-launch.mjs`)
- ✅ TUI command: `/goose` (`bin/opencode-ink.mjs`)
- 🟡 Manual QA: requires Goose + Rust toolchain (or `goose` binary) installed, and a browser for the web UI

Enhancements
- Add “desktop/electron” mode bootstrap (large install; best behind explicit `/goose setup-desktop`).
- Add context handoff: selected Explorer files → push into Goose session via a preloaded system prompt.

---

## Quick Manual QA Script (Recommended)
1. Launch TUI and verify Explorer: `Ctrl+E`, `Ctrl+R`, `Ctrl+H`.
2. Verify `/open package.json`, `/search TODO`.
3. Run `/doctor` and confirm tools show expected states.
4. Run `/preview on 15044` and confirm browser opens.
5. Trigger a browser automation task and confirm it routes to Playwright and can dismiss popups.
6. Run `/goose` (requires Goose prerequisites).

