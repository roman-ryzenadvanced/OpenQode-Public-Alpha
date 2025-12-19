/**
 * Part Model - Structured message parts
 * 
 * Based on sst/opencode message architecture
 * Credit: https://github.com/sst/opencode
 * 
 * Normalizes all content into typed parts for consistent rendering
 */

// Part types enum
export const PART_TYPES = {
    TEXT: 'text',           // User/assistant prose
    REASONING: 'reasoning', // Thinking/intent trace
    TOOL_CALL: 'tool_call', // Tool invocation
    TOOL_RESULT: 'tool_result', // Tool output
    FILE_SNIPPET: 'file_snippet', // Code file content
    DIFF: 'diff',           // Diff view
    TODO: 'todo',           // Todo/checklist
    SYSTEM: 'system',       // System message
    ERROR: 'error'          // Error message
};

/**
 * Create a text part (user/assistant prose)
 */
export function createTextPart(content, role = 'assistant') {
    return {
        type: PART_TYPES.TEXT,
        role,
        content,
        timestamp: Date.now()
    };
}

/**
 * Create a reasoning part (thinking/intent trace)
 */
export function createReasoningPart(intent, next, why = null, steps = []) {
    return {
        type: PART_TYPES.REASONING,
        intent,
        next,
        why,
        steps,
        timestamp: Date.now()
    };
}

/**
 * Create a tool call part
 */
export function createToolCallPart(toolName, args = {}, status = 'running') {
    return {
        type: PART_TYPES.TOOL_CALL,
        toolName,
        args,
        status, // 'running' | 'done' | 'failed'
        timestamp: Date.now()
    };
}

/**
 * Create a tool result part
 */
export function createToolResultPart(toolName, output, summary = null, exitCode = 0) {
    return {
        type: PART_TYPES.TOOL_RESULT,
        toolName,
        output,
        summary,
        exitCode,
        isError: exitCode !== 0,
        timestamp: Date.now()
    };
}

/**
 * Create a file snippet part
 */
export function createFileSnippetPart(filename, content, language = null, startLine = 1) {
    const lines = content.split('\n').length;
    return {
        type: PART_TYPES.FILE_SNIPPET,
        filename,
        content,
        language: language || detectLanguage(filename),
        startLine,
        lineCount: lines,
        timestamp: Date.now()
    };
}

/**
 * Create a diff part
 */
export function createDiffPart(filename, diff, mode = 'unified') {
    return {
        type: PART_TYPES.DIFF,
        filename,
        diff,
        mode, // 'unified' | 'split'
        timestamp: Date.now()
    };
}

/**
 * Create a todo part
 */
export function createTodoPart(items) {
    return {
        type: PART_TYPES.TODO,
        items: items.map(item => ({
            text: item.text,
            status: item.status || 'pending', // 'pending' | 'in_progress' | 'done'
            checked: item.status === 'done'
        })),
        timestamp: Date.now()
    };
}

/**
 * Create a system part
 */
export function createSystemPart(content, subtype = 'info') {
    return {
        type: PART_TYPES.SYSTEM,
        content,
        subtype, // 'info' | 'warning' | 'success'
        timestamp: Date.now()
    };
}

/**
 * Create an error part
 */
export function createErrorPart(message, details = null, stack = null) {
    return {
        type: PART_TYPES.ERROR,
        message,
        details,
        stack,
        timestamp: Date.now()
    };
}

/**
 * Detect language from filename
 */
function detectLanguage(filename) {
    if (!filename) return null;
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap = {
        js: 'javascript', mjs: 'javascript', cjs: 'javascript',
        ts: 'typescript', tsx: 'typescript',
        py: 'python',
        rb: 'ruby',
        go: 'go',
        rs: 'rust',
        java: 'java',
        c: 'c', cpp: 'cpp', h: 'c',
        cs: 'csharp',
        php: 'php',
        sh: 'bash', bash: 'bash',
        ps1: 'powershell',
        json: 'json',
        yaml: 'yaml', yml: 'yaml',
        md: 'markdown',
        html: 'html',
        css: 'css',
        sql: 'sql'
    };
    return langMap[ext] || null;
}

/**
 * Parse raw message content into parts
 * Extracts code blocks, tool calls, etc.
 */
export function parseContentToParts(content, role = 'assistant') {
    const parts = [];

    // Simple parsing - extract code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        // Text before code block
        if (match.index > lastIndex) {
            const text = content.slice(lastIndex, match.index).trim();
            if (text) {
                parts.push(createTextPart(text, role));
            }
        }

        // Code block
        const lang = match[1] || null;
        const code = match[2];
        parts.push(createFileSnippetPart(null, code, lang));

        lastIndex = match.index + match[0].length;
    }

    // Remaining text after last code block
    if (lastIndex < content.length) {
        const text = content.slice(lastIndex).trim();
        if (text) {
            parts.push(createTextPart(text, role));
        }
    }

    // If no parts created, treat entire content as text
    if (parts.length === 0) {
        parts.push(createTextPart(content, role));
    }

    return parts;
}

export default {
    PART_TYPES,
    createTextPart,
    createReasoningPart,
    createToolCallPart,
    createToolResultPart,
    createFileSnippetPart,
    createDiffPart,
    createTodoPart,
    createSystemPart,
    createErrorPart,
    parseContentToParts
};
