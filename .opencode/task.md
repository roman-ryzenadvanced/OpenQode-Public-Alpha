# Task: Enhance AI Communication Patterns

## Objectives
- [x] Integrate `agent-prompt.mjs` for dynamic system prompts
- [x] Implement `fetchWithRetry` for robust API calls
- [x] Enhance TUI message rendering with `message-renderer.mjs` formatters

## Progress
- [x] Create Implementation Plan
- [x] Backup `qwen-oauth.mjs` and `bin/opencode-ink.mjs`
- [x] Update `qwen-oauth.mjs`:
    - [x] Import `fetchWithRetry`
    - [x] Add `systemPrompt` support to `sendMessage`
    - [x] Wrap `sendVisionMessage` with retry logic
- [x] Update `bin/opencode-ink.mjs`:
    - [x] Import `getSystemPrompt` and `fetchWithRetry`
    - [x] Refactor `handleSubmit` to use dynamic system prompt
    - [x] Update `callOpenCodeFree` to use `fetchWithRetry`
    - [x] Apply `formatSuccess`/`formatError` to file save output
- [ ] User Verification of functionality
