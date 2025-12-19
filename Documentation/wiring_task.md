# OpenQode Feature Wiring Task List

## Power Features (from implementation_plan_power_features.md)
- [ ] **TODO Tracker**
    - [ ] Verify `lib/todo-scanner.mjs` exists and logic is correct
    - [ ] Verify `bin/ui/components/CleanTodoList.mjs`
    - [ ] Wire up `TodoList` in `opencode-ink.mjs` Sidebar
- [ ] **Theme Switcher**
    - [ ] Verify `bin/themes.mjs` exists
    - [ ] Verify `/theme` command in `bin/opencode-ink.mjs`
    - [ ] Ensure Theme context is applied to all components
- [ ] **Fuzzy File Finder**
    - [ ] Create `FuzzyFinder` component (if missing)
    - [ ] Implement fuzzy matching logic
    - [ ] Wire up `/find` command or keybind in `opencode-ink.mjs`

## Clean UI (from implementation_plan_clean_ui.md)
- [ ] **Real-Time Agent Display**
    - [ ] Verify `ThinkingBlock.mjs` (Done?)
    - [ ] Ensure `activeAgent` is passed correctly in `opencode-ink.mjs`
- [ ] **Clean Message Rendering**
    - [ ] Verify `ChatBubble.mjs` implementation
    - [ ] Replace legacy message rendering in `opencode-ink.mjs` with `ChatBubble`
    - [ ] Fix "i text" artifact issues (System messages)

## Verification
- [ ] Test TODOs scanning
- [ ] Test Theme switching
- [ ] Test Fuzzy Finder
- [ ] Visual check of Chat UI
