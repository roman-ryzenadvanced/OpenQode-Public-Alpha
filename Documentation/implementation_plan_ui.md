# Pro-Grade UI Implementation Plan

## Goal
Eliminate the "Wall of Text" by introducing a Card/Bubble architecture. Messages should feel distinct, structured, and "Pro".

## User Review Required
> [!IMPORTANT]
> **Layout Change**: User messages will now align to the RIGHT. AI messages to the LEFT. This is standard in modern chat layouts but a departure from typical CLI tools.

## Proposed Changes

### 1. New Component: `ChatBubble.mjs`
- **Location**: `bin/ui/components/ChatBubble.mjs`
- **Flex Logic**:
  - `User`: `flexDirection: row-reverse`. Text aligns right. Box has Cyan border.
  - `AI`: `flexDirection: row`. Text aligns left. Box has Gray/White border.
  - `System`: Compact, centered or subtle left-border.

### 2. Integration: `ViewportMessage` Redesign
- **File**: `bin/opencode-ink.mjs`
- **Change**: Replace the current `ViewportMessage` implementation.
- **Logic**:
  - Instead of `h(Text)`, use `h(ChatBubble, { role, content })`.
  - Pass `width` effectively to ensure bubbles wrap correctly.

### 3. "The Ghost Box" (Thinking)
- **Status**: Already separated (previous task). We will give it a "Glass" look (dimmed, single border).

## Verification Plan
1.  **Chat Flow**:
    - Send "Hello". Verify it appears on the Right (Cyan).
    - AI replies. Verify it appears on the Left.
    - Error occurs. Verify it appears as a distinct Red Card.
2.  **Responsiveness**:
    - Resize window. Ensure bubbles resize and don't overlap.

