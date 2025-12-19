# Responsive Layout Hardening Plan

## Goal
Fix "eaten/overlapped" text by enforcing strict horizontal boundaries and increasing safety margins for the TUI renderer.

## User Review Required
> [!NOTE]
> This change will slightly narrow the text area (by ~2 chars) to ensure borders never cut off content.

## Proposed Changes

### 1. `ViewportMessage` Hardening
- **File**: `bin/opencode-ink.mjs`
- **Change**: Pass `width - 6` to Markdown children (User/AI).
- **Reason**: Accounts for Border (2) + Padding (2) + Safe Margin (2).
- **Style**: Add `overflow: 'hidden'` to the bubble container.

### 2. `ThinkingBlock` Constraints
- **File**: `bin/ui/components/ThinkingBlock.mjs`
- **Change**: Ensure it accepts `width` prop and passes `width - 4` to internal text.

### 3. `ScrollableChat` Verification
- **File**: `bin/opencode-ink.mjs`
- **Action**: Verify `ScrollableChat` container clips overflow correctly.

## Verification Plan
1.  **Resize Test**: Drag terminal window to different sizes.
2.  **Long Line Test**: Genrate a long path (`/a/very/long/path/...`). Verify it wraps or truncates, doesn't explode layout.
