# Sidebar Activity Pulse Plan

## Goal
Add real-time "Pace & Speed" visualization to the Sidebar.

## User Review Required
> [!NOTE]
> Token count is an *estimation* (Chars / 4) because real-time token counts are not available in the stream chunks.

## Proposed Changes

### 1. Update `App` (`opencode-ink.mjs`)
- Pass `thinkingStats` prop to `<Sidebar />`.

### 2. Update `Sidebar` Component (`opencode-ink.mjs`)
- **New Section**: "⚡ ACTIVITY"
- **Logic**:
  - `estTokens = Math.floor(thinkingStats.chars / 4)`
  - `speed = ...` (Calculate chars/sec if possible, or just show raw counts first).
- **Visuals**:
  - `Running: 1,240 chars`
  - `Est. Tokens: 310`
  - `[▓▓▓░░] Pulse` (Simple animation or spinner?) -> "⚡ PROCESSING" blinking?

## Verification Plan
1.  **Run Chat**: Ask a long question.
2.  **Observe**: Check Sidebar for "⚡ ACTIVITY" section.
3.  **Confirm**: Verify numbers increase in real-time.
