# OpenCode Features Implementation

## Features to Implement (Priority Order)

### 1. Permission Dialog (High Priority)
**Goal**: Ask user approval before file writes/commands
- Add `pendingAction` state: `{ type: 'write'|'run', payload }`
- Show confirmation overlay: "Allow AI to write file.js? [Y/n]"
- Keybinds: `y` approve, `n` deny, `a` approve all

### 2. Session Management (High Priority)  
**Goal**: Save/load conversation sessions
- Create `.opencode/sessions/` directory
- `/save [name]` - Save current session
- `/load [name]` - Load session
- `/sessions` - List saved sessions
- Store as JSON: `{ messages, agent, project, timestamp }`

### 3. File Change Tracking (High Priority)
**Goal**: Track files modified during session
- Add `modifiedFiles` state: `Set<filepath>`
- Update on every `writeFile()` call
- Show in sidebar: "📝 Modified (3)"
- `/changes` - Show full diff summary

### 4. Custom Commands (Medium Priority)
**Goal**: User-defined command templates
- Create `.opencode/commands/` directory
- Format: `command-name.md` with `{{arg}}` placeholders
- `/cmd <name> [args]` - Execute custom command

### 5. External Editor (Low Priority)
**Goal**: Open $EDITOR for long messages
- `/edit` - Opens temp file in $EDITOR
- On save, content becomes input
- Requires `child_process.spawn`

---

## Implementation Order
1. Permission Dialog (most impactful for safety)
2. Session Management (user-requested persistence)
3. File Change Tracking (visibility)
4. Custom Commands (power users)
5. External Editor (nice-to-have)
