# IQ Exchange Integration Implementation Plan

## Goal
Fully integrate the "Translation Layer" into IQ Exchange and upgrade the underlying tooling to use robust Windows UI Automation (UIA) hooks. This replaces blind coordinate-based actions with reliable element-based interactions.

## User Review Required
> [!IMPORTANT]
> This integration involves modifying the core `input.ps1` script to use .NET UIA assemblies. This is a significant upgrade that requires PowerShell 5.1+ (standard on Windows 10/11).

## Proposed Changes

### Phase 1: Enhanced Tooling (UIA Support)
Upgrade the low-level execution tools to support robust automation.

#### [MODIFY] [bin/input.ps1](file:///e:/TRAE Playground/Test Ideas/OpenQode-v1.01-Preview/bin/input.ps1)
- **Add:** .NET System.Windows.Automation assembly loading.
- **Add:** `Find-Element` helper function using `AutomationElement.RootElement.FindFirst`.
- **Add:** `Invoke-Element` for UIA InvokePattern (reliable clicking).
- **Add:** `Get-AppState` to dump window structure for context.
- **Implement:** `uiclick`, `waitfor`, `find`, `app_state` commands.

#### [MODIFY] [lib/computer-use.mjs](file:///e:/TRAE Playground/Test Ideas/OpenQode-v1.01-Preview/lib/computer-use.mjs)
- **Expose:** New UIA commands in the `desktop` object.
- **Add:** `getAppState(app_name)` function.

### Phase 2: Translation Layer
Implement the "Brain" that converts natural language to these new robust commands.

#### [MODIFY] [lib/iq-exchange.mjs](file:///e:/TRAE Playground/Test Ideas/OpenQode-v1.01-Preview/lib/iq-exchange.mjs)
- **New Method:** `translateRequest(userPrompt, context)`
- **System Prompt:** Specialized prompt that knows the *exact* API of `input.ps1` and Playwright.
- **Output:** Returns a structured list of commands (JSON or Code Block).

### Phase 3: Main Loop Integration
Hook the translation layer into the TUI.

#### [MODIFY] [bin/opencode-ink.mjs](file:///e:/TRAE Playground/Test Ideas/OpenQode-v1.01-Preview/bin/opencode-ink.mjs)
- **Update:** `handleExecuteCommands` or the stream handler.
- **Logic:**
    1. Detect "computer use" intent.
    2. Call `iqExchange.translateRequest()`.
    3. Auto-execute the returned robust commands.
    4. Use existing `auto-heal` if they fail.

### Phase 3.5: Vision Integration
Ensure the AI "Brain" knows it has eyes.

#### [MODIFY] [lib/iq-exchange.mjs](file:///e:/TRAE Playground/Test Ideas/OpenQode-v1.01-Preview/lib/iq-exchange.mjs)
- **Update:** `translateRequest` System Prompt to include:
    - `ocr "region"` -> Read text from screen (Textual Vision).
    - `screenshot "file"` -> Capture visual state.
    - `app_state "App"` -> Structural Vision (Tree Dump).
- **Update:** `buildHealingPrompt` to remind AI of these tools during retries.

## Verification Plan

### Automated Tests
- [x] Verified `ocr` command works (internal logic check)
- [x] Verified `waitfor` command signature matches translation prompt
- [x] Verified `open` command error handling handles `stderr`
- **Integration Test:** Verify `translateRequest` returns valid commands for "Open Notepad and type Hello".

### Manual Verification
- [x] "Open Paint and draw a rectangle" -> Confirmed robust translation plan generation.
- [x] "Check text on screen" -> Confirmed `ocr` command availability.
- [x] "Button list" -> Confirmed `app_state` command availability.

### Manual QA
- **User Scenario:** "Open Paint and draw a rectangle."
- **Success Criteria:**
    - Agent converts intent to `open mspaint`, `waitfor`, `uiclick`.
    - Execution works without "blind" clicking.
    - If paint fails to open, auto-heal detects and fixes.
