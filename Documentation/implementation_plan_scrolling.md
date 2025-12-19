# Block-Based Scrolling Plan

## Goal
Fix "data cut off" issues by making the chat scrollable by **Blocks** (Paragraphs/Code) instead of whole Messages. This ensures that even long responses can be fully viewed.

## User Review Required
> [!IMPORTANT]
> This changes scrolling behavior: 1 keypress = 1 paragraph/block, not 1 full message.

## Proposed Changes

### 1. Helper: `flattenMessagesToBlocks` (`opencode-ink.mjs`)
- **Input**: Array of `messages`.
- **Output**: Array of `RenderBlock` objects:
  - `{ id, role, type: 'text' | 'code', content, meta }`
- **Logic**:
  - Iterate messages.
  - Split `content` by Code Fences (```).
  - Split Text chunks by Double Newlines (`\n\n`) to get paragraphs.
  - Return flat list.

### 2. Refactor `ScrollableChat` (`opencode-ink.mjs`)
- **Hook**: `const blocks = useMemo(() => flattenMessagesToBlocks(messages), [messages]);`
- **Render**:
  - `visibleBlocks = blocks.slice(scrollOffset, scrollOffset + maxItems)`
  - Map `visibleBlocks` to `ViewportMessage` (modified to handle simple content).

### 3. Update `ViewportMessage`
- It currently expects a full message interactively. 
- We will reuse it, but pass the *Block Content* as the message content.
- This maintains the "Card/Rail" look for each paragraph.

## Verification Plan
1.  **Long Text Test**: Paste a long prompt.
2.  **Scroll**: Verify Up/Down arrow moves paragraph-by-paragraph.
3.  **Check**: Ensure no text is clipped at the top/bottom of the view.
