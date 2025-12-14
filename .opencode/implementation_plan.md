# Implementation Plan - Integrating Enhanced Agent Communication

## Goal Description
Integrate the new `agent-prompt.mjs` module (concise, direct, informative patterns) into the OpenQode TUI. Refactor `server.js` (if applicable) and primarily `bin/opencode-ink.mjs` and `qwen-oauth.mjs` to support dynamic system prompt injection and robust retry mechanisms for API calls.

## User Review Required
> [!IMPORTANT]
> The `qwen-oauth.mjs` `sendMessage` signature will be updated to accept `systemPrompt` as a 5th argument. This is a non-breaking change as it defaults to null, but ensures future compatibility.

## Proposed Changes

### Core Logic

#### [MODIFY] [qwen-oauth.mjs](file:///e:/TRAE%20Playground/Test%20Ideas/OpenQode-v1.01-Preview/qwen-oauth.mjs)
- Update `sendMessage` to accept `systemPrompt` as the 5th argument.
- Use the provided `systemPrompt` instead of the hardcoded `systemContext`.
- Import `fetchWithRetry` from `lib/retry-handler.mjs` (module import).
- Wrap `sendVisionMessage`'s `fetch` call with `fetchWithRetry`.

#### [MODIFY] [bin/opencode-ink.mjs](file:///e:/TRAE%20Playground/Test%20Ideas/OpenQode-v1.01-Preview/bin/opencode-ink.mjs)
- Import `getSystemPrompt` from `../lib/agent-prompt.mjs`.
- Import `fetchWithRetry` from `../lib/retry-handler.mjs` (for `callOpenCodeFree`).
- In `handleSubmit`:
    - Gather context (CWD, project context, memories).
    - Call `getSystemPrompt({ capabilities, cwd, context, projectContext })` to generate the cleaner prompt.
    - Pass this `systemPrompt` to `qwen.sendMessage` as the 5th argument.
    - PASS ONLY the user request (and maybe immediate context like "clipboard content") as the message content, removing the manual prompt concatenation.
- In `callOpenCodeFree`:
    - Use `fetchWithRetry` instead of raw `fetch`.

## Verification Plan

### Automated Tests
- None available for TUI interaction.

### Manual Verification
1.  **System Prompt Check**: Send a message like "create a file test.txt". Verify the agent responds concisely (OpenCode style) and uses the correct code block format, proving `getSystemPrompt` was used.
2.  **Retry Check**: Disconnect internet (if possible) or simulate a timeout to verify `fetchWithRetry` logs attempts and handles failure gracefully.
3.  **Vision Check**: Send an image command (if possible via TUI) to verify `sendVisionMessage` still works with retry.
