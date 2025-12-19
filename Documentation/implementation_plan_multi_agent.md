# Real-Time Multi-Agent Visualization Plan

## Goal
Show which specific agent (e.g., Security, Planner, Builder) is currently active in real-time during the "Thinking" phase.

## User Review Required
> [!TIP]
> This relies on "Prompt Engineering" to force the AI to self-report its agent usage. It acts like a "verbose mode" for the internal router.

## Proposed Changes

### 1. Prompt Injection (`opencode-ink.mjs`)
- **Check**: `if (multiAgentEnabled)` in prompt construction.
- **Append**:
  ```text
  [MULTI-AGENT LOGGING]
  When delegating to a sub-agent or switching context, you MUST start the line with:
  [AGENT: <AgentName>] <Action description>
  Example:
  [AGENT: Security] Scanning for auth vulnerabilities...
  [AGENT: Planner] Breaking down the task...
  ```

### 2. Stream Parsing (`opencode-ink.mjs`)
- **Logic**:
  - Regex: `/\[AGENT:\s*([^\]]+)\]/i`
  - If match found: Update `thinkingStats.activeAgent`.

### 3. UI Update (`ThinkingBlock.mjs`)
- **Visual**:
  - If `stats.activeAgent` is present, display:
    `🧠 Thinking (<activeAgent>)...` instead of just `Thinking...`.

## Verification Plan
1.  **Setup**: Enable `/agents` mode.
2.  **Trigger**: Ask "Plan a secure login system and check for bugs".
3.  **Verify**: Watch the Thinking Block switch from `Thinking...` -> `Thinking (Planner)...` -> `Thinking (Security)...`.
