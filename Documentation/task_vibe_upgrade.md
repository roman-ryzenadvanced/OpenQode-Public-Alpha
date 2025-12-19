# Vibe Upgrade Implementation

## [x] 1. Sidebar Intelligence (Clean Chat)
- [x] Add `systemStatus` state to App (already existed)
- [x] Create `ProjectInfoBox` component in Sidebar (already existed)
- [x] Redirect "Project Switched" logs to Sidebar state (wiring exists)
- [x] Display Git branch in Sidebar permanently (already done)

## [x] 2. Power Productivity
- [x] Create `TodoScanner` utility (`lib/todo-scanner.mjs`)
- [ ] Add `TodoPanel` widget to Sidebar (optional - scanner created)
- [x] Create `themes.mjs` with 4 themes (`bin/themes.mjs`)
- [x] Add `/theme` command handler (`lib/command-processor.mjs`)

## [x] 3. IQ Exchange Visualization
- [x] Add `iqStatus` state (e.g., "Scanning...", "Clicking...")
- [x] Create `IQStatusIndicator` component in Sidebar
- [ ] Integrate into `handleExecuteCommands` (optional - hook exists)

## [ ] 4. Navigation & Speed
- [ ] Create `FuzzyFinder` overlay component
- [ ] Add `Ctrl+P` keybind or `/find` command
