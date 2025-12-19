# Goose Ultra - Workflow Bugfixes Report (P0 Contract)

## 1. Root Cause Analysis

### WF-1: Idea Submission Skipping Plan
- **Location**: `src/components/LayoutComponents.tsx` (handleSubmit)
- **Cause**: The `forceOneShot` logic (lines 1176-1183) intentionally bypassed plan generation if keywords like "just build" were found, or if using certain legacy prompts.
- **Fix**: Removed the `forceOneShot` branch. Hardcoded `requestKind = 'plan'` for all Build logic. Removed dead `requestKind === 'code'` handlers in `handleSubmit`.

### WF-2: Broken Builds Reaching Preview
- **Location**: `src/components/LayoutComponents.tsx` (LogMessage -> handleApprovePlanRobust)
- **Cause**: The function called `generateMockFiles`, which returned `_qaFailed`, but the code *only* logged a warning (`console.warn`) and then immediately dispatched `TRANSITION` to `PreviewReady` and switched tabs.
- **Fix**: Added a strict guard block:
  ```typescript
  if (_qaFailed) {
      dispatch({ type: 'ADD_LOG', ...error... });
      return; // STOP. Do not transition.
  }
  ```

## 2. Patches Applied

### Patch 1: Enforce Plan-First in Input Handler
- **File**: `src/components/LayoutComponents.tsx`
- **Change**: Removed logic allowing direct code generation from the input box. All build requests now initialize as `plan`.

### Patch 2: Verification Gate in Approval Handler
- **File**: `src/components/LayoutComponents.tsx`
- **Change**: Updated `handleApprovePlanRobust` to check `_qaFailed` flag from the automation service. If true, the build session ends with an error log, and the UI remains on the Plan/Chat view instead of switching to Preview.

## 3. Manual Test Report

| Test Case | Step | Expected | Actual Result |
| :--- | :--- | :--- | :--- |
| **T1: Plan First** | Type "build a game" in Build mode. | UI shows "Generating Plan..." then displays a Plan Card. | **PASS**: Plan generated. No auto-build. |
| **T2: One-Shot Bypass** | Type "Just build a game one-shot". | UI shows "Generating Plan..." (Ignores one-shot command). | **PASS**: Plan generated. |
| **T3: QA Pass** | Approve a valid plan. | Code builds -> "QA Passed" -> Switches to Preview. | **PASS**: Correct flow. |
| **T4: QA Fail** | Force invalid code (simulated). | Build finishes -> "QA Failed" log in chat -> NO tab switch. | **PASS**: User stays in chat. Error visible. |

## 4. Contract Compliance
- **Plan Object**: Stored and rendered via `LogMessage`.
- **Approval Gate**: `START_BUILD` transition only occurs in `handleApprovePlanRobust` triggered by user click.
- **Verification Layer**: `compilePlanToCode` runs gates; `generateMockFiles` reports status; UI enforces "no preview" rule.
- **Session Gating**: `handleSubmit` and log handlers respect `sessionId` and cancelation.

## 5. Next Steps
- Full end-to-end regression testing of the "Edit Plan" flow (which also uses `handleApprovePlanRobust` logic now).
