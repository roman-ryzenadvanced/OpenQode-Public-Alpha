# Walkthrough: Enhanced Agent Communication

I have successfully integrated the enhanced system prompt, retry mechanism, and TUI formatters.

## Changes Applied

### 1. Robust API Calls (`qwen-oauth.mjs`)
- **Retry Logic**: Integrated `fetchWithRetry` for Vision API calls.
- **Dynamic System Prompt**: `sendMessage` now accepts a `systemPrompt` argument, allowing the TUI to inject context-aware instructions instead of relying on hardcoded overrides.

### 2. TUI Logic (`bin/opencode-ink.mjs`)
- **System Prompt Injection**: `handleSubmit` now generates a clean, role-specific system prompt using `lib/agent-prompt.mjs`.
- **Stream Refactoring**: Unified the streaming callback logic for cleaner code.
- **Retry Integration**: `callOpenCodeFree` now uses `fetchWithRetry` for better resilience.
- **Visual Feedback**: File save operations now use `formatSuccess` and `formatFileOperation` for consistent, bordered output.

## Verification Steps

> [!IMPORTANT]
> You **MUST** restart your TUI process (`node bin/opencode-ink.mjs`) for these changes to take effect.

1.  **Restart the TUI**.
2.  **Test System Prompt**:
    - Send a simple greeting: "Hello".
    - **Expected**: A concise, direct response (no "As an AI..." preamble).
    - ask "Create a file named `demo.txt` with text 'Hello World'".
    - **Expected**: The agent should generate the file using the correct code block format.
3.  **Test Visual Feedback**:
    - Observe the success message after file creation.
    - **Expected**: A green bordered box saying "✅ Success" with the file details.
4.  **Test Retry (Optional)**:
    - If you can simulate a network glitch, the system should now log "Retrying...".

## Rollback
Backups were created before applying changes:
- `qwen-oauth.mjs.bak`
- `bin/opencode-ink.mjs.bak`
