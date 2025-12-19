# Next-Gen TUI Implementation Task List

- [ ] **Phase 1: Safety & Foundation**
    - [x] Backup stable `opencode-ink.mjs`.
    - [ ] Create `implementation_plan.md`.

- [ ] **Phase 2: The Interactive Context Matrix (File Tree)**
    - [ ] Create `bin/ui/components/FileTree.mjs` component.
        - [ ] Implement recursive directory reading.
        - [ ] Implement key handling (Up/Down/Space/Enter).
        - [ ] Implement selection state (for Context).
    - [ ] Integrate `FileTree` into `Sidebar`.
    - [ ] Add `Tab` toggle mode (Chat <-> Sidebar focus).

- [ ] **Phase 3: "Holographic" Rich Diff Review**
    - [ ] Create `bin/ui/components/DiffView.mjs`.
        - [ ] Render side-by-side or split diff using `diff` library logic.
        - [ ] Add "Apply/Reject" interactive buttons.
    - [ ] Update `opencode-ink.mjs` execution flow to intercept file writes.
        - [ ] Show DiffView before `/write` execution.

- [ ] **Phase 4: "Noob Friendly" Auto-Drive**
    - [ ] Implement `AutoDrive` toggle in Settings.
    - [ ] Add heuristics: Small changes (<5 lines) auto-applied? 
    - [ ] OR: "Explain then Act" mode where AI explains in simple terms.

- [ ] **Phase 5: Syntax-Highlighted Input**
    - [ ] Replace `ink-text-input` with custom `RichInput` component.
    - [ ] Integrate `ink-syntax-highlight` on the input buffer.

- [ ] **Phase 6: Verification**
    - [ ] Test Navigation.
    - [ ] Test Context selection.
    - [ ] Test Diff application.
