# TUI 5 Feature Enhancements - Implementation Plan

## Overview
Implementing 5 features inspired by Mini-Agent concepts, written as **100% original code** for TUI 5's React Ink architecture.

---

## Phase 1: Persistent Session Memory 🥇

### Files to Create
- `lib/session-memory.mjs` - SessionMemory class

### Implementation
```javascript
// lib/session-memory.mjs
class SessionMemory {
    constructor() {
        this.memoryFile = '.openqode-memory.json';
        this.facts = [];
    }
    
    async load() { /* Load from JSON file */ }
    async save() { /* Save to JSON file */ }
    async remember(fact) { /* Add fact with timestamp */ }
    async forget(index) { /* Remove fact by index */ }
    getContext() { /* Return facts as system prompt addition */ }
}
```

### Commands
- `/remember <fact>` - Save important context
- `/forget <index>` - Remove a remembered fact
- `/memory` - Show all remembered facts

---

## Phase 2: Intelligent Context Summarization 🥈

### Files to Create
- `lib/context-manager.mjs` - ContextManager class

### Implementation
```javascript
class ContextManager {
    constructor(tokenLimit = 100000) {
        this.tokenLimit = tokenLimit;
    }
    
    countTokens(text) { /* Estimate tokens */ }
    shouldSummarize(messages) { /* Check if > 50% limit */ }
    async summarize(messages) { /* Call AI to summarize old messages */ }
}
```

### UI Indicator
Show `[Context: 45%]` in stats panel

---

## Phase 3: Skills Library 🥉

### Files to Create
- `skills/index.mjs` - Skills registry
- `skills/definitions/` - Individual skill files

### Built-in Skills
| Skill | Description |
|-------|-------------|
| `pdf` | Generate PDF documentation |
| `test` | Create unit tests |
| `review` | Code review analysis |
| `docs` | Generate documentation |
| `refactor` | Suggest refactoring |

### Commands
- `/skills` - List available skills
- `/skill <name>` - Execute a skill

---

## Phase 4: Request Logging

### Implementation
- Add `--debug` CLI flag
- Create `.openqode-debug.log`
- Log API calls with timestamps
- `/debug` toggle command

---

## Phase 5: MCP Support (Future)

Research and design phase - defer to later sprint.

---

## Verification
- Test each feature in isolation
- Verify no regressions in existing functionality
- Push to GitHub after each phase
