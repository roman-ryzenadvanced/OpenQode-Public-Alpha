# Remaining Tasks for Full "Noob-Proof" Delivery

## 1. Create One Last Component
- [x] **`SnippetBlock.mjs`**: Consolidate code/snippet rendering (User Spec Item 8).
  - *Decision*: Aliasing `CodeCard.mjs` which already implements this pattern correctly.

## 2. Main Layout Wiring (The "All Front End" part)
- [ ] **Inspectors** (`Desktop`, `Browser`, `Server`):
  - *Status*: Created but **not imported or rendered**.
  - *Task*: Wire into a conditional "Inspector Panel" (right side or toggle) that appears during automation.
- [ ] **Preview Plan**:
  - *Status*: Created but **not wired**.
  - *Task*: Render `PreviewPlan` component when run state is `PREVIEWING`.
- [ ] **Automation Timeline**:
  - *Status*: Created but **not wired**.
  - *Task*: Render `AutomationTimeline` component when run state is `RUNNING` or `VERIFYING`.
- [ ] **Getting Started**:
  - *Status*: Created but **not wired**.
  - *Task*: Render `GettingStartedCard` in the sidebar or main panel when history is empty.
- [ ] **Clean Todo List**:
  - *Status*: Created but **not wired**.
  - *Task*: Replace the legacy `TodoList` component with `CleanTodoList`.

## 3. Data Wiring (The "Logic" part)
- [ ] **State Connectivity**:
  - Ensure the `runState` (Idle/Preview/Run) actually triggers the view switches.
  - *Note*: Since we are mimicking the UI, we might need to mock the state transition for the user to see it in `OpenQode.bat` -> Option 2.

## 4. Final Verification
- [ ] Run syntax check on `opencode-ink.mjs`.
- [ ] Verify no "double borders" or layout breaks.
