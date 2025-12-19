# Real-Time Token Counter Plan

## Goal
Show a live character/token count next to the "Thinking..." indicator so the user knows the AI is working.

## User Review Required
> [!NOTE]
> This consolidates the "Thinking" UI into one block (removing the duplicate "Ghost Text").

## Proposed Changes

### 1. State Management (`opencode-ink.mjs`)
- **Add State**: `const [thinkingStats, setThinkingStats] = useState({ chars: 0, steps: 0 });`
- **Reset**: In `handleSubmit`, set `thinkingStats` to `{ chars: 0, steps: 0 }`.

### 2. Stream Logic (`opencode-ink.mjs`)
- **Modify**: Inside `sendMessage` callback (or `handleChunk`):
    - Increment `thinkingStats.chars` by chunk length.
    - If newline detected in thinking block, increment `thinkingStats.steps` (optional, existing logic tracks lines).

### 3. UI Cleanup (`opencode-ink.mjs`)
- **Remove**: Delete `GhostText` rendering at line ~2200.
- **Update**: Pass `stats={thinkingStats}` to `ThinkingBlock`.

### 4. Component Update (`ThinkingBlock.mjs`)
- **Display**: Render `(N chars)` or `(~N tokens)` next to "Thinking...".

## Verification Plan
1.  **Usage Test**: Ask "Calculate fibonacci 100".
2.  **Visual Check**: Watch the counter increment in real-time.
3.  **UI Check**: Ensure only ONE thinking block appears.
