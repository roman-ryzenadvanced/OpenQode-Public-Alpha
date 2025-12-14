/**
 * Enhanced Message Renderer - OpenCode-inspired code display and file delivery
 * Based on: https://github.com/opencode-ai/opencode
 * 
 * Features:
 * A. Code blocks with language-aware syntax styling
 * B. File delivery with full paths and status icons
 * C. Animated todo/task progress with checkmarks
 */

import React from 'react';
const { useState, useEffect, useRef } = React;

// ═══════════════════════════════════════════════════════════════
// A. CODE BLOCK RENDERING
// ═══════════════════════════════════════════════════════════════

/**
 * Format a code block with filename header (OpenCode style)
 * @param {string} filename - File name to display in header
 * @param {string} code - Code content
 * @param {string} language - Language for syntax highlighting
 * @param {number} width - Width of the box
 * @returns {string} Formatted code block
 */
export function formatCodeBox(filename, code, language = '', width = 60) {
    // Get language from filename extension if not provided
    if (!language && filename) {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        language = getLanguageFromExt(ext);
    }

    const boxWidth = Math.min(width, 80);
    const headerPadding = Math.max(0, boxWidth - filename.length - 5);

    const header = `┌─ ${filename} ${'─'.repeat(headerPadding)}┐`;
    const footer = `└${'─'.repeat(boxWidth)}┘`;

    // Format code lines with left border
    const lines = code.split('\n').map(line => {
        const truncated = line.length > boxWidth - 4 ? line.substring(0, boxWidth - 7) + '...' : line;
        const padding = Math.max(0, boxWidth - 2 - truncated.length);
        return `│ ${truncated}${' '.repeat(padding)}│`;
    });

    return `${header}\n${lines.join('\n')}\n${footer}`;
}

/**
 * Get language identifier from file extension
 */
function getLanguageFromExt(ext) {
    const map = {
        'js': 'javascript',
        'mjs': 'javascript',
        'jsx': 'jsx',
        'ts': 'typescript',
        'tsx': 'tsx',
        'py': 'python',
        'rb': 'ruby',
        'go': 'go',
        'rs': 'rust',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'h': 'c',
        'css': 'css',
        'scss': 'scss',
        'html': 'html',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml',
        'md': 'markdown',
        'sh': 'bash',
        'sql': 'sql'
    };
    return map[ext] || 'text';
}

/**
 * Truncate content to max height (OpenCode pattern)
 */
export function truncateHeight(content, maxLines = 10) {
    const lines = content.split('\n');
    if (lines.length > maxLines) {
        return lines.slice(0, maxLines - 1).join('\n') + `\n... (${lines.length - maxLines + 1} more lines)`;
    }
    return content;
}

// ═══════════════════════════════════════════════════════════════
// B. FILE DELIVERY WITH FULL PATHS
// ═══════════════════════════════════════════════════════════════

/**
 * Format file operation notification (OpenCode style)
 * Shows: icon + action + full path
 */
export function formatFileDelivery(action, filePath, options = {}) {
    const { bytesWritten, linesChanged, isError = false } = options;

    // Action icons and labels (OpenCode toolName pattern)
    const actions = {
        write: { icon: '📝', label: 'Written', verb: 'Wrote' },
        create: { icon: '✨', label: 'Created', verb: 'Created' },
        edit: { icon: '✏️', label: 'Edited', verb: 'Edited' },
        delete: { icon: '🗑️', label: 'Deleted', verb: 'Deleted' },
        read: { icon: '📖', label: 'Read', verb: 'Read' },
        patch: { icon: '🔧', label: 'Patched', verb: 'Patched' },
        view: { icon: '👁️', label: 'Viewing', verb: 'View' }
    };

    const actionInfo = actions[action] || { icon: '📁', label: action, verb: action };

    // Build the notification
    let notification = `${actionInfo.icon} ${actionInfo.verb}: ${filePath}`;

    // Add metadata if available
    const meta = [];
    if (bytesWritten) meta.push(`${formatBytes(bytesWritten)}`);
    if (linesChanged) meta.push(`${linesChanged} lines`);

    if (meta.length > 0) {
        notification += ` (${meta.join(', ')})`;
    }

    if (isError) {
        notification = `❌ Failed to ${action}: ${filePath}`;
    }

    return notification;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * Format file path for display (remove working dir prefix)
 */
export function formatPath(fullPath, workingDir = process.cwd()) {
    if (fullPath.startsWith(workingDir)) {
        return fullPath.slice(workingDir.length).replace(/^[\/\\]/, '');
    }
    return fullPath;
}

// ═══════════════════════════════════════════════════════════════
// C. TODO/TASK PROGRESS WITH ANIMATION
// ═══════════════════════════════════════════════════════════════

/**
 * Format a todo item with status
 */
export function formatTodoItem(item, options = {}) {
    const { animated = true, index = 0 } = options;

    const icons = {
        pending: '○',    // Empty circle
        inProgress: '◐',    // Half circle (animated)
        completed: '●',    // Filled circle
        failed: '✗'     // Cross
    };

    const colors = {
        pending: 'gray',
        inProgress: 'yellow',
        completed: 'green',
        failed: 'red'
    };

    const status = item.status || (item.completed ? 'completed' : 'pending');
    const icon = icons[status] || icons.pending;

    // Animation frames for in-progress
    const spinFrames = ['◐', '◓', '◑', '◒'];
    const animatedIcon = animated && status === 'inProgress'
        ? spinFrames[Math.floor(Date.now() / 200) % spinFrames.length]
        : icon;

    const prefix = index > 0 ? `${index}. ` : '';

    return {
        text: `${prefix}${animatedIcon} ${item.text || item.content}`,
        color: colors[status],
        icon: animatedIcon
    };
}

/**
 * Format a task checklist (multiple todos)
 */
export function formatTaskChecklist(tasks, options = {}) {
    const { title = 'Tasks', showProgress = true } = options;

    const completed = tasks.filter(t => t.completed || t.status === 'completed').length;
    const total = tasks.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Progress bar
    const barWidth = 20;
    const filledWidth = Math.round((completed / total) * barWidth);
    const progressBar = showProgress
        ? `[${'█'.repeat(filledWidth)}${'░'.repeat(barWidth - filledWidth)}] ${percent}%`
        : '';

    // Header
    let output = `📋 ${title} ${progressBar}\n`;
    output += '─'.repeat(40) + '\n';

    // Items
    tasks.forEach((task, i) => {
        const item = formatTodoItem(task, { index: i + 1 });
        output += `   ${item.text}\n`;
    });

    return output.trim();
}

/**
 * Tool progress messages (OpenCode getToolAction pattern)
 */
export function getToolProgress(toolName) {
    const actions = {
        'bash': 'Running command...',
        'write': 'Writing file...',
        'edit': 'Editing file...',
        'read': 'Reading file...',
        'view': 'Viewing file...',
        'search': 'Searching...',
        'grep': 'Searching content...',
        'glob': 'Finding files...',
        'list': 'Listing directory...',
        'patch': 'Applying patch...',
        'fetch': 'Fetching URL...',
        'task': 'Preparing task...',
        'agent': 'Delegating to agent...'
    };
    return actions[toolName.toLowerCase()] || 'Working...';
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export default {
    // Code display
    formatCodeBox,
    truncateHeight,
    getLanguageFromExt,

    // File delivery
    formatFileDelivery,
    formatPath,

    // Todo/Task progress
    formatTodoItem,
    formatTaskChecklist,
    getToolProgress
};
