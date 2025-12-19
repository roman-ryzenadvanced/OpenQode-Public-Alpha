# User Request: Wire Power Features & Clean UI

The goal is to finalize the implementation of "Power Features" and "Clean UI" by wiring existing components into the main TUI (`bin/opencode-ink.mjs`) and creating the missing Fuzzy Finder.

## User Review Required
> [!NOTE]
> This plan modifies the core `opencode-ink.mjs` file.
> It introduces a new `FuzzyFinder` component and updates the Sidebar and Chat rendering.

## Proposed Changes

### 1. New Component: Fuzzy File Finder
**File**: `bin/ui/components/FuzzyFinder.mjs` [NEW]
- Create a fuzzy file finder overlay.
- Uses `glob` or recursive scan to get file list.
- Filters list based on user input.
- Displays results with `ink-select-input`.

### 2. Sidebar Integration: Todo List
**File**: `bin/opencode-ink.mjs`
- Import `CleanTodoList` from `./ui/components/CleanTodoList.mjs`.
- Import `scanTodos` from `../lib/todo-scanner.mjs`.
- Add state: `const [todos, setTodos] = useState([])`.
- Add effect: Run `scanTodos` on startup and file changes.
- Pass `todos` prop to `PremiumSidebar`.

**File**: `bin/ui/components/PremiumSidebar.mjs`
- Accept `todos` prop.
- Render `CleanTodoList` in a new section (or replace Shortcuts if crowded, or collapsible).

### 3. Chat UI Clean-up: ChatBubble
**File**: `bin/opencode-ink.mjs`
- Import `ChatBubble` from `./ui/components/ChatBubble.mjs`.
- Update `ViewportMessage` (internal component) or `ScrollableChat` to render `ChatBubble` instead of raw `Box`/`Text`.
- logic to route `system` messages through `ChatBubble` with `role="system"`.

### 4. Theme Switcher
**File**: `bin/opencode-ink.mjs`
- Convert `theme` constant to state: `const [activeTheme, setActiveTheme] = useState(THEMES.dracula)`.
- Add `/theme` command to `showCommandPalette` or command processor to allow switching.
- Ensure `activeTheme` is passed to components that need it (or they import it - might need refactoring if they import static `theme`).
    - *Note*: `tui-theme.mjs` exports a static `theme`. We might need to implement a Context or pass theme props. For now, we will use a simple state and pass it where possible, or update the global if `ink` allows (unlikely pure global).
    - *Strategy*: We will pass `theme` as prop to `PremiumSidebar`, `ChatBubble`, etc.

## Verification Plan

### Automated Tests
- None currently available for TUI visual regression.

### Manual Verification
1.  **Fuzzy Finder**: Press `Ctrl+P` (or typed command `/find`). Type `server`. Verify `server.js` is found.
2.  **Todo List**: Check Sidebar for "Tasks" section. Verify it shows TODOs from project files.
3.  **Chat UI**: Send a message "hello". Verify user message is right-aligned/styled. Response is left-aligned with clean gutter.
4.  **Themes**: Type `/theme monokai`. Verify Sidebar colors change.
