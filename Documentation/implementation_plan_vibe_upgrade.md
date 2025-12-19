# Vibe Upgrade: Enhanced TUI Experience Plan

## Goal
Transform OpenQode from a "Terminal Chat" into a "Power TUI IDE" by integrating system status, productivity tools, and IQ visualization into a cohesive interface.

## 1. Sidebar Intelligence (Clean Chat)
**Problem:** Main chat is cluttered with "Project Switched" and "Rooted" system logs.
**Solution:** Move persistent state to the Sidebar.

- [ ] **System Status Box:** Add a "Project Info" section in Sidebar.
- [ ] **State Management:** Replace chat logging with `setSystemStatus({ msg, type })`.
- [ ] **Git Info:** Display current branch/status in Sidebar permanently.

## 2. Power Productivity (Sidebar Expansion)
**Problem:** Space in Sidebar is underutilized.
**Solution:** Add dynamic productivity widgets.

- [ ] **TODO Tracker:** Auto-scan `// TODO` comments and list them in Sidebar.
    - *Regex scan of open files.*
- [ ] **Theme Switcher:** interactive `/theme` command.
    - *Themes: Dracula (default), Monokai, Matrix, Nord.*

## 3. IQ Exchange Visualization (See it Thinking)
**Problem:** "Computer Use" happens invisibly or via raw logs.
**Solution:** Visual indicators for Agent actions.

- [ ] **Action Status:** Show "👁️ Scanning Screen..." or "🖱️ Clicking..." in a dedicated status line or spinner, separate from chat text.
- [ ] **Vision Preview:** If `screenshot` is taken, try to show a tiny ASCII preview or path reference in the chat.

## 4. Navigation & Speed
- [ ] **Fuzzy Finder:** Ctrl+P overlay to jump to files (simulating VS Code).

## Implementation Order
1. **Refactor Sidebar:** Create `SystemStatus` component.
2. **Move Logs:** Update `opencode-ink.mjs` to push status to sidebar.
3. **Add TODOs:** Implement `TodoScanner`.
4. **Theme Engine:** Add `ThemeProvider` context.
