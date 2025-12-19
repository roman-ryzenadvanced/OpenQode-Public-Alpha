# Walkthrough - IQ Exchange Integration & Fixes

We have successfully integrated the **IQ Exchange Translation Layer** and **Vision Capabilities** into the OpenQode TUI and resolved critical execution fragility.

## 🚀 Key Features Implemented

### 1. The Translation Layer (`lib/iq-exchange.mjs`)
- **New Brain:** `translateRequest(userPrompt)` method acting as a cognitive bridge.
- **Robust Protocol:** Converts natural language (e.g., "Open Spotify") into precise PowerShell/Playwright commands.
- **System Commands:**
    - `uiclick`: Reliable UIA-based clicking (no more blind coordinates).
    - `waitfor`: Synchronization primitive to prevent racing the UI.
    - `app_state`: Structural vision to "see" window contents.

### 2. Vision Integration (User Request)
The AI now has full vision capabilities exposed in its system prompt:
- **`ocr "region"`**: Reads text from the screen using Windows OCR (Windows 10/11 native).
- **`app_state "App"`**: Dumps the UI hierarchy to understand button names and inputs.
- **`screenshot "file"`**: Captures visual state.

### 3. Execution Robustness (Fixes)
- **Resolved "Unknown Error":** Fixed quoting logic in `executeAny` regex to handle arguments with spaces properly (`"mspaint.exe"` was breaking).
- **Better Error Reporting:** `input.ps1` now explicitly writes to Stderr when `Start-Process` fails, giving the AI actionable feedback.

## 🧪 Verification Results

### Static Analysis
| Component | Status | Notes |
|-----------|--------|-------|
| `input.ps1` | ✅ Verified | `ocr` implemented, `open` uses explicit error handling. |
| `iq-exchange.mjs` | ✅ Verified | Translation prompts include vision; regex fixed for quoted args. |
| `opencode-ink.mjs` | ✅ Verified | `handleSubmit` handles translation and errors. |

### Manual Verification Steps
To verify this in the live TUI:

1. **Launch OpenQode:** `npm run tui`
2. **Textual Vision Test:**
   - Prompt: "Check the text on my active window using OCR."
   - Expected: Agent runs `powershell bin/input.ps1 ocr "full"` and reports the text.
3. **Robust Action Test (Fixed):**
   - Prompt: "Open Notepad and type 'Hello World'."
   - Expected:
     ```powershell
     powershell bin/input.ps1 open "Notepad"
     powershell bin/input.ps1 waitfor "Untitled" 5
     powershell bin/input.ps1 type "Hello World"
     ```
   - **Fix Verification:** Should no longer show "Unknown error" or exit code 1.
4. **Structural Vision Test:**
   - Prompt: "What buttons are available in the Calculator app?"
   - Expected: Agent runs `powershell bin/input.ps1 app_state "Calculator"` and lists the button hierarchy.

## ⚠️ Notes
- **OCR Requirement:** Requires Windows 10 1809+ with a language pack installed (standard on most systems).
- **Permissions:** PowerShell scripts run with `-ExecutionPolicy Bypass`.
