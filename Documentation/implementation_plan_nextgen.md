# Next-Gen TUI Implementation Plan

## Goal
Transform the TUI into a "Tactile" IDE by adding interactive file exploration (Context Matrix) and safe code application (Rich Diff Review).

## User Review Required
> [!IMPORTANT]
> **New Dependencies**: We need to add `diff` package for the diff view.
> **Navigation Change**: `Tab` key will now toggle focus between Chat Input and Sidebar. This changes existing behavior (previously Tab toggled Sidebar visibility in narrow mode).

## Proposed Changes

### 1. New Component: `FileTree.mjs`
- **Location**: `bin/ui/components/FileTree.mjs`
- **Functionality**:
  - Recursive directory walker.
  - State: `expandedFolders` (Set), `selectedFiles` (Set).
  - UI:
    - `▼ folder/`
    - `  [x] file.js`
  - Interaction:
    - `Up/Down`: Navigate.
    - `Right/Enter`: Expand folder.
    - `Left`: Collapse folder.
    - `Space`: Toggle selection (Add/Remove from Context).

### 2. Updated Sidebar
- **File**: `bin/opencode-ink.mjs`
- **Change**: Render `FileTree` inside Sidebar when focused.
- **State**: Track `sidebarFocus` boolean.

### 3. New Component: `DiffView.mjs`
- **Location**: `bin/ui/components/DiffView.mjs`
- **Functionality**:
  - Input: `originalContent`, `newContent`.
  - Output: Visual diff (Green lines for additions, Red for deletions).
  - Interactive Footer: `[ Apply ]  [ Reject ]`.

### 4. Integration Logic
- **File**: `bin/opencode-ink.mjs`
- **Change**:
  - Intercept `/write` command or "CREATE:" blocks.
  - Instead of writing immediately, store in `pendingDiff`.
  - Render `DiffView` overlay.
  - Wait for user `Apply` signal.

## Verification Plan

### Manual Verification
1. **Navigation**:
   - Run TUI. Press `Tab` to focus Sidebar.
   - Use Arrow keys. Ensure cursor moves.
   - Expand `bin/`. See files.

2. **Context Selection**:
   - Navigate to `package.json`. Press `Space`.
   - Verify visually (Green checkmark).
   - Send message "What is in the selected file?". Verify AI sees it.

3. **Diff Review**:
   - Ask AI "Refactor the file header".
   - AI outputs code.
   - **Expected**: Diff View appears showing changes.
   - Select `Apply`.
   - Verify file is written.
