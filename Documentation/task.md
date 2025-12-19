```
# IQ Exchange Integration Task List

- [/] Planning & Setup
    - [x] Create implementation plan
    - [/] Review existing `input.ps1` and `iq-exchange.mjs`
- [x] Phase 1: Enhanced Tooling (Library Update)
    - [x] Add `waitfor` command to `bin/input.ps1`
    - [x] Add `app_state` command to `bin/input.ps1`
    - [x] Update `lib/computer-use.mjs` to expose new commands
- [x] Phase 2: The "Translation Layer"
    - [x] Implement `translateRequest` in `lib/iq-exchange.mjs`
    - [x] Create specialized system prompt for translation
- [x] Phase 3: Main Loop Integration
    - [x] Modify `opencode-ink.mjs` to use `translateRequest` for "computer use" intents
    - [x] Ensure `IQExchange` class uses the robust commands
- [x] Phase 3.5: Vision Integration (User Request)
    - [x] Update `translateRequest` prompt in `lib/iq-exchange.mjs` to expose `ocr`, `screenshot`
    - [x] Update `buildHealingPrompt` in `lib/iq-exchange.mjs` with vision tools
    - [x] Verify `input.ps1` OCR output format is AI-friendly
    - [x] Test with "Open Paint and draw a circle"
    - [x] Verify auto-heal still works with new commands
```
