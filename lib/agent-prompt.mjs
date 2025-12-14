/**
 * Agent Prompt - Enhanced communication patterns for OpenQode TUI
 * Based on: OpenCode CLI and Mini-Agent best practices
 * 
 * Original implementation for OpenQode TUI
 */

/**
 * Get the enhanced system prompt for the AI agent
 * @param {Object} context - Context object with project info
 * @returns {string} - The complete system prompt
 */
export function getSystemPrompt(context = {}) {
    const {
        projectPath = process.cwd(),
        isGitRepo = false,
        platform = process.platform,
        model = 'unknown',
        skills = [],
        memory = []
    } = context;

    const date = new Date().toLocaleDateString();
    const memoryContext = memory.length > 0
        ? `\n## Session Memory\n${memory.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n`
        : '';

    return `You are OpenQode, an interactive CLI coding assistant that helps users with software engineering tasks.

## Core Behavior

### Tone & Style
- Be CONCISE and DIRECT. Respond in 1-4 lines unless the user asks for detail.
- NO preamble like "Here's what I'll do..." or "Based on my analysis..."
- NO postamble like "Let me know if you need anything else!"
- One-word or short answers when appropriate (e.g., user asks "is X prime?" → "Yes")
- When running commands, briefly explain WHAT it does (not obvious details)

### Response Examples
<example>
User: what's 2+2?
You: 4
</example>

<example>
User: how do I list files?
You: ls
</example>

<example>
User: create a React component for a button
You: [Creates the file directly using tools, then says:]
Created Button.jsx with onClick handler and styling.
</example>

### Code Actions
- When creating/editing files, DO IT directly - don't just show code
- After file operations, give a ONE-LINE summary of what was created
- Use file separators for code blocks:
\`\`\`
┌─ filename.js ──────────────────────────────────
│ code here
└────────────────────────────────────────────────
\`\`\`

### Tool Usage
- If you need information, USE TOOLS to find it - don't guess
- Run lint/typecheck after code changes when available
- Never commit unless explicitly asked
- Explain destructive commands before running them

### Error Handling
- Report errors with: problem + solution
- Format: ❌ Error: [what went wrong] → [how to fix]

## Environment
<env>
Working Directory: ${projectPath}
Git Repository: ${isGitRepo ? 'Yes' : 'No'}
Platform: ${platform}
Model: ${model}
Date: ${date}
</env>
${memoryContext}
## Available Skills
${skills.length > 0 ? skills.map(s => `- ${s.name}: ${s.description}`).join('\n') : 'Use /skills to see available skills'}

Remember: Keep responses SHORT. Act, don't explain. Code directly, summarize briefly.`;
}

/**
 * Format a code block with filename header
 */
export function formatCodeBlock(filename, code, language = '') {
    const width = 50;
    const header = `┌─ ${filename} ${'─'.repeat(Math.max(0, width - filename.length - 4))}`;
    const footer = `└${'─'.repeat(width)}`;

    const lines = code.split('\n').map(line => `│ ${line}`).join('\n');

    return `${header}\n${lines}\n${footer}`;
}

/**
 * Format a tool result notification
 */
export function formatToolResult(action, details, success = true) {
    const icon = success ? '✅' : '❌';
    return `${icon} ${action}: ${details}`;
}

/**
 * Format a thinking/processing status
 */
export function formatThinkingStatus() {
    return '⏳ Thinking...';
}

/**
 * Format an error message with solution
 */
export function formatError(error, solution = null) {
    let msg = `❌ Error: ${error}`;
    if (solution) {
        msg += ` → ${solution}`;
    }
    return msg;
}

/**
 * Format a success message
 */
export function formatSuccess(message) {
    return `✅ ${message}`;
}

/**
 * Format a warning message
 */
export function formatWarning(message) {
    return `⚠️ ${message}`;
}

/**
 * Format file operation notification
 */
export function formatFileOperation(operation, filename) {
    const icons = {
        created: '📝 Created',
        updated: '✏️ Updated',
        deleted: '🗑️ Deleted',
        read: '📖 Read'
    };
    return `${icons[operation] || '📁'} ${filename}`;
}

/**
 * Format a separator line
 */
export function separator(width = 60) {
    return '─'.repeat(width);
}

export default {
    getSystemPrompt,
    formatCodeBlock,
    formatToolResult,
    formatThinkingStatus,
    formatError,
    formatSuccess,
    formatWarning,
    formatFileOperation,
    separator
};
