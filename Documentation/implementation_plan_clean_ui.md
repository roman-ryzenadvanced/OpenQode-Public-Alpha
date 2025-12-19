# Clean Communication Flow Implementation

## Problem
1. "i text" boxes appearing (Markdown parsing artifacts)
2. Messy text flow with excessive borders
3. Multi-agent feature doesn't show which agent is active in real-time

## Proposed Changes

### 1. Real-Time Agent Display in Sidebar
**File**: `bin/opencode-ink.mjs`
- Already partially implemented (`thinkingStats.activeAgent`)
- **Fix**: Ensure the streaming loop actually detects and sets the active agent
- **UI**: Add prominent agent indicator in sidebar "⚡ LIVE" section

### 2. Clean Up Message Rendering
**File**: `bin/opencode-ink.mjs`

#### A. Fix "i text" boxes
- These appear to be Markdown rendering of system messages
- **Fix**: Route system messages through `SystemCard` instead of `Markdown`
- Remove borders from inline system messages

#### B. Simplify ViewportMessage
- Remove nested borders
- Use minimal left-gutter style (single colored bar, no box)
- Match Antigravity style: clean text, subtle role indicators

### 3. ChatBubble Redesign
**Pattern**: Antigravity/AI Studio/Codex style
- User messages: Right-aligned or `> prompt` style
- Assistant: Clean left-aligned text with minimal header
- System: Single-line muted text, no boxes

## Verification
1. **Visual Test**: Restart TUI, send message, verify clean text flow
2. **Agent Test**: Enable multi-agent (`/settings`), ask security question, verify agent name appears in sidebar
