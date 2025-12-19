# TUI Visual & Flow Overhaul Plan

## Goal
Drastically improve the "Design Flow" and "Text Flow" of the TUI as requested.
1.  **Eliminate Visual Glitches**: Fix text "eating" and "off" wrapping.
2.  **Separate Thinking**: Move AI reasoning into a dedicated, collapsible UI block.
3.  **Fix Command Logic**: Remove duplicate `/write` handler that prevents the Diff View from working.

## User Review Required
> [!IMPORTANT]
> **Experience Change**: "Thinking" text (e.g., "Let me analyze...") will no longer appear in the main chat stream. It will appear in a separate "Ghost Box" above the chat. This makes the final output cleaner.

## Proposed Changes

### 1. Fix Logic Conflict
- **File**: `bin/opencode-ink.mjs`
- **Action**: Delete the old `case '/write':` block (lines ~1372-1387) to allow the new "Holographic Diff" handler (lines ~1592) to take effect.

### 2. New Component: `ThinkingBlock.mjs`
- **Location**: `bin/ui/components/ThinkingBlock.mjs`
- **Features**:
  - Displays "🧠 Thinking..." header.
  - Shows last 3 lines of thinking process (or full log if expanded).
  - Dimmed color (gray) to reduce visual noise.
  - Pulsing animation? (Maybe just simple text for stability).

### 3. Stream Processor (The "Flow" Engine)
- **File**: `bin/opencode-ink.mjs`
- **Logic**:
  - Introduce `thinkingContent` state.
  - Update `sendMessage` callback:
    - **Heuristic**: If line starts with "Let me", "I will", "Thinking:", enter **Thinking Mode**.
    - **Heuristic**: If line starts with "Here is", "Below", or markdown `#`, enter **Response Mode**.
    - Split the stream: Thinking -> `thinkingContent`, Response -> `messages`.

### 4. Layout Tuning
- **Action**: Increase safety margin for `mainWidth` calculation (-6 chars) to prevent edge glitches.
- **Action**: Ensure `Markdown` renderer gets explicit `width` prop.

## Verification Plan
1.  **Diff Test**:
    - Run `/write` again. Confirm Holographic Diff appears (proving old handler is gone).
2.  **Thinking Flow Test**:
    - Ask "Calculate the Fibonacci sequence in Python and explain".
    - **Expected**:
        - "Thinking" box appears, updating with reasoning.
        - Main chat remains empty or shows "Processing...".
        - Once actual answer starts, Main chat fills with Markdown.
        - Result is clean, formatted code.
3.  **Layout Test**:
    - Resize window during output. Verify no text is "eaten".
