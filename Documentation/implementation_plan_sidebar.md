# Sidebar System Status Implementation Plan

## Goal
De-clutter the main chat by moving "System Status" messages (e.g., "Project Switched", "Current Root") to the Sidebar.

## User Review Required
> [!IMPORTANT]
> **Experience Change**: "Project Switched" messages will no longer appear in the chat history. They will update the "Project Info" section in the Sidebar.

## Proposed Changes

### 1. New State in `App`
- **File**: `bin/opencode-ink.mjs`
- **State**: `const [systemStatus, setSystemStatus] = useState(null);`
- **Structure**: `{ message: string, type: 'success' | 'info', timestamp: number }`

### 2. Modify `Sidebar` Component
- **File**: `bin/opencode-ink.mjs`
- **Addition**: A new "Project Info" box below the title.
- **Render**: Display `project` path (truncated) and last status message.

### 3. Redirect Messages
- **Analysis**: Find where "Project Switched" is logged (likely `useEffect` on startup or `selectProject` handler).
- **Change**: Replace `setMessages(...)` with `setSystemStatus(...)`.

## Verification Plan
1.  **Startup Test**:
    - Launch TUI. 
    - Verify "System is now rooted..." appears in Sidebar, NOT in chat.
2.  **Switch Test**:
    - Select a new project.
    - Verify status updates in Sidebar.
