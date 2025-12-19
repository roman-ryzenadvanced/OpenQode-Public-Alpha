# Power IDE Features Implementation

## Overview
Implementing 3 flagship features to make OpenQode feel like a powerful Vibe Coding IDE.

---

## 1. TODO Tracker (Low Effort, High Visibility)
**Goal**: Auto-parse `// TODO:` comments from project files and display in sidebar.

### Implementation
1. Create `parseTodos(projectPath)` function:
   - Recursively scan `.js`, `.ts`, `.py`, `.md` files
   - Regex match `// TODO:`, `# TODO:`, `<!-- TODO:` patterns
   - Return `[{ file, line, text }]`

2. Add `TodoPanel` component in Sidebar:
   - Shows "📝 TODOs (X)" header
   - Lists top 5 TODOs with file:line references
   - Click to expand full list

---

## 2. Theme Switcher (Low Effort, High Impact)
**Goal**: Switch between color themes via `/theme` command.

### Implementation
1. Create `themes.mjs` with theme definitions:
   - `dracula`: Current default (cyan/magenta/green)
   - `monokai`: Orange/yellow/green
   - `nord`: Blue/cyan/white
   - `matrix`: Green/black

2. Add theme state to App:
   - `const [theme, setTheme] = useState('dracula')`
   - Apply theme colors to all components

3. Add `/theme` command:
   - `/theme` → Shows picker
   - `/theme monokai` → Switch directly

---

## 3. Fuzzy File Finder (Medium Effort, Flagship)
**Goal**: Ctrl+P style quick-open for files.

### Implementation
1. Create `FuzzyFinder` overlay component:
   - Text input for search query
   - Real-time filtered file list
   - Arrow keys to navigate, Enter to preview

2. Add fuzzy matching algorithm:
   - Score based on character position matching
   - Highlight matched characters

3. Trigger via `/find` command or Ctrl+P keybind

---

## Verification
1. **TODO**: Run app, verify TODOs appear in sidebar
2. **Theme**: Run `/theme matrix`, verify colors change
3. **Finder**: Run `/find`, type "server", verify fuzzy results
