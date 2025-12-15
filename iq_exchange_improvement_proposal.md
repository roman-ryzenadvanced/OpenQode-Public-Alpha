# IQ Exchange & Computer Use: Research & Improvement Proposal

## Executive Summary
The current IQ Exchange implementation in `opencode-ink.mjs` provides a basic retry loop but lacks a robust "Translation Layer" for converting natural language into precise computer actions. It currently relies on placeholder logic or simple string matching.

Research into state-of-the-art agents (Windows-Use, browser-use, OpenDevin) reveals that reliable agents use **structured translation layers** that map natural language to specific, hook-based APIs (Playwright, UIA) rather than fragile shell commands or pure vision.

This proposal outlines a plan to upgrade the IQ Exchange with a proper **AI Translation Layer** and a **Robust Execution Loop** inspired by these findings.

---

## 1. Analysis of Current Implementation

### Strengths
- **Retry Loop:** `IQExchange` class has a solid retry mechanism with `maxRetries`.
- **Feedback Loop:** Captures stdout/stderr and feeds it back to the AI for self-healing.
- **Task Detection:** Simple regex-based detection for browser vs. desktop tasks.

### Weaknesses
- **Missing Translation Layer:** The `opencode-ink.mjs` file has a placeholder comment `// NEW: Computer Use Translation Layer` but no actual AI call to convert "Open Spotify and play jazz" into specific PowerShell/Playwright commands. It relies on the *main* chat response to hopefully contain the commands, which is unreliable.
- **Fragile Command Parsing:** `extractCommands` uses regex finding \`\`\` code blocks, which can be hit-or-miss if the AI is chatty.
- **No Structural Enforcing:** The AI is free to hallucinate commands or arguments.

---

## 2. Research Findings & Inspiration

### A. Windows-Use (CursorTouch)
- **Key Insight:** Uses **native UI Automation (UIA)** hooks instead of just vision.
- **Relevance:** We should prefer `Input.ps1` using UIA (via PowerShell .NET access) over blind mouse coordinates.
- **Takeaway:** The Translation Layer should map "Click X" to `uiclick "X"` (UIA) rather than `mouse x y`.

### B. browser-use
- **Key Insight:** **Separation of Concerns**.
    1. **Perception:** Get DOM/State.
    2. **Cognition (Planner):** Decide *next action* based on state.
    3. **Action:** Execute.
- **Relevance:** Our loop tries to do everything in one prompt.
- **Takeaway:** We should split the "Translation" step.
    1. User Request -> Translator AI (Specialized System Prompt) -> Standardized JSON/Script
    2. Execution Engine -> Runs Script
    3. Result -> Feedback

### C. Open-Interface
- **Key Insight:** **Continuous Course Correction**. Takes screenshots *during* execution to verify state.
- **Relevance:** Our current loop only checks return codes (exit code 0/1).
- **Takeaway:** We need "Verification Steps" in our commands (e.g., `waitfor "WindowName"`).

---

## 3. Proposed Improvements

### Phase 1: The "Translation Layer" (Immediate Fix)
Instead of relying on the main chat model to implicitly generate commands, we introduce a **dedicated translation step**.

**Workflow:**
1. **Detection:** Main Chat detects intent (e.g., "Computer Use").
2. **Translation:** System calls a fast, specialized model (or same model with focused prompt) with the *specific schema* of available tools.
   - **Input:** "Open Spotify and search for Jazz"
   - **System Prompt:** "You are a Command Translator. Available tools: `open(app)`, `click(text)`, `type(text)`. Output ONLY the plan."
   - **Output:**
     ```powershell
     powershell bin/input.ps1 open "Spotify"
     powershell bin/input.ps1 waitfor "Search" 5
     powershell bin/input.ps1 uiclick "Search"
     powershell bin/input.ps1 type "Jazz"
     ```
3. **Execution:** The existing `IQExchange` loop runs this reliable script.

### Phase 2: Enhanced Tooling (Library Update)
Update `lib/computer-use.mjs` and `bin/input.ps1` to support **UIA-based robust actions**:
- `uiclick "Text"`: Finds element by text name via UIA (more robust than coordinates).
- `waitfor "Text"`: Polling loop to wait for UI state changes.
- `app_state "App"`: Returns detailed window state/focus.

### Phase 3: The "Cognitive Loop" (Architecture Shift)
Move from **"Plan -> Execute All"** to **"Observe -> Plan -> Act -> Observe"**.
- Instead of generating a full script at start, the agent generates *one step*, executes it, observes the result (screenshot/output), then generates the next step.
- This handles dynamic popups and loading times much better.

---

## 4. Implementation Plan (for Phase 1 & 2)

### Step 1: Implement Dedicated Translation Function
In `lib/iq-exchange.mjs` or `bin/opencode-ink.mjs`, create `translateToCommands(userRequest, context)`:
- Uses a strict system prompt defining the *exact* API.
- Enforces output format (e.g., JSON or strict Code Block).

### Step 2: Integrate into `handleExecuteCommands`
- Detect if request is "Computer Use".
- If so, *pause* main chat generation.
- Call `translateToCommands`.
- Feed result into the `auto-heal` loop.

### Step 3: Upgrade `input.ps1`
- Ensure it supports the robust UIA methods discovered in Windows-Use (using .NET `System.Windows.Automation`).

## 5. User Review Required
- **Decision:** Do we want the full "Cognitive Loop" (slower, more tokens, highly reliable) or the "Batch Script" approach (faster, cheaper, less robust)?
- **Recommendation:** Start with **Batch Script + Translation Layer** (Phase 1). It fits the current TUI architecture best without a total rewrite.
