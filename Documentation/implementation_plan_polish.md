# UI Polish & Timeout Extension Plan

## Goal
Make the UI "Pro-Grade" by removing boxy borders and using a sleek "Rail System" layout. Fix request timeouts by extending the limit.

## User Review Required
> [!IMPORTANT]
> **Visual Overhaul**: Messages will no longer be enclosed in boxes. 
> - **AI** will have a colored **Left Gutter**.
> - **User** will have a colored **Right Gutter**.
> - This mimics modern editors like Cursor.

## Proposed Changes

### 1. Fix Timeout (Stability)
- **File**: `qwen-oauth.cjs`
- **Change**: Increase `setTimeout` from `120000` (2m) to `300000` (5m).
- **Reason**: 120s is too short for complex reasoning.

### 2. Redesign `ErrorCard`
- **File**: `bin/opencode-ink.mjs` (inline `ErrorCard`)
- **Change**: Remove the hardcoded "Error" title text. Just render the content.
- **Reason**: Prevents "Error: Error: ..." redundancy.

### 3. "Rail" UI Implementation
- **File**: `bin/ui/components/ChatBubble.mjs`
- **Change**: 
    - **User**: Remove `borderStyle`. Right align text. Add Right Gutter `|`.
    - **AI**: Remove `borderStyle`. Left align. Add Left Gutter `|`.
- **File**: `bin/opencode-ink.mjs` (`ViewportMessage`)
    - Ensure margins are compatible with Rail design.

## Verification Plan
1.  **Visual Test**: Send "Hello". Verify Right-Rail look. Response should have Left-Rail.
2.  **Timeout Test**: Impossible to force-fail easily without waiting 5 mins, but code review confirms the change.
