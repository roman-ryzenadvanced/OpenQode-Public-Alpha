/**
 * Tool Registry - Renders tool-specific UI
 * 
 * Based on sst/opencode ToolRegistry pattern
 * Credit: https://github.com/sst/opencode
 * 
 * Each tool has a dedicated renderer for consistent output
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../../tui-theme.mjs';
import { icon } from '../../icons.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

// Registry of tool renderers
const toolRenderers = new Map();

/**
 * Register a tool renderer
 * @param {string} toolName - Tool identifier
 * @param {object} renderer - { icon, title, renderSummary, renderDetails }
 */
export function registerTool(toolName, renderer) {
    toolRenderers.set(toolName, {
        icon: renderer.icon || '⚙',
        iconAscii: renderer.iconAscii || '*',
        title: renderer.title || toolName,
        color: renderer.color || colors.accent,
        renderSummary: renderer.renderSummary || defaultRenderSummary,
        renderDetails: renderer.renderDetails || defaultRenderDetails
    });
}

/**
 * Get renderer for a tool
 */
export function getToolRenderer(toolName) {
    return toolRenderers.get(toolName) || {
        icon: '⚙',
        iconAscii: '*',
        title: toolName,
        color: colors.muted,
        renderSummary: defaultRenderSummary,
        renderDetails: defaultRenderDetails
    };
}

/**
 * Default summary renderer
 */
function defaultRenderSummary(args, status) {
    const summary = Object.entries(args || {})
        .slice(0, 2)
        .map(([k, v]) => `${k}=${String(v).slice(0, 20)}`)
        .join(', ');
    return summary || 'Running...';
}

/**
 * Default details renderer
 */
function defaultRenderDetails(args, result) {
    if (result?.output) {
        return result.output.slice(0, 500);
    }
    return JSON.stringify(args, null, 2).slice(0, 500);
}

// ============================================
// BUILT-IN TOOL RENDERERS
// ============================================

// File read tool
registerTool('read_file', {
    icon: '📄',
    iconAscii: '[R]',
    title: 'Read File',
    color: colors.accent,
    renderSummary: (args) => args?.path || 'reading...',
    renderDetails: (args, result) => result?.content?.slice(0, 500) || ''
});

// File write tool
registerTool('write_file', {
    icon: '✏️',
    iconAscii: '[W]',
    title: 'Write File',
    color: 'green',
    renderSummary: (args) => args?.path || 'writing...',
    renderDetails: (args) => `${args?.content?.split('\n').length || 0} lines`
});

// Edit file tool
registerTool('edit_file', {
    icon: '📝',
    iconAscii: '[E]',
    title: 'Edit File',
    color: 'yellow',
    renderSummary: (args) => args?.path || 'editing...',
    renderDetails: (args) => args?.description || ''
});

// Delete file tool
registerTool('delete_file', {
    icon: '🗑️',
    iconAscii: '[D]',
    title: 'Delete File',
    color: 'red',
    renderSummary: (args) => args?.path || 'deleting...',
    renderDetails: () => ''
});

// Shell/command tool
registerTool('shell', {
    icon: '💻',
    iconAscii: '>',
    title: 'Shell',
    color: 'magenta',
    renderSummary: (args) => {
        const cmd = args?.command || args?.cmd || '';
        return cmd.length > 40 ? cmd.slice(0, 37) + '...' : cmd;
    },
    renderDetails: (args, result) => result?.output?.slice(0, 1000) || ''
});

registerTool('run_command', {
    icon: '💻',
    iconAscii: '>',
    title: 'Command',
    color: 'magenta',
    renderSummary: (args) => {
        const cmd = args?.command || args?.CommandLine || '';
        return cmd.length > 40 ? cmd.slice(0, 37) + '...' : cmd;
    },
    renderDetails: (args, result) => result?.output?.slice(0, 1000) || ''
});

// Search tool
registerTool('search', {
    icon: '🔍',
    iconAscii: '?',
    title: 'Search',
    color: colors.accent,
    renderSummary: (args) => args?.query || args?.pattern || 'searching...',
    renderDetails: (args, result) => `${result?.matches?.length || 0} matches`
});

registerTool('grep_search', {
    icon: '🔍',
    iconAscii: '?',
    title: 'Grep',
    color: colors.accent,
    renderSummary: (args) => args?.Query || 'searching...',
    renderDetails: (args, result) => `${result?.matches?.length || 0} matches`
});

// List files tool
registerTool('list_files', {
    icon: '📁',
    iconAscii: '[L]',
    title: 'List Files',
    color: colors.muted,
    renderSummary: (args) => args?.path || args?.directory || '.',
    renderDetails: (args, result) => `${result?.files?.length || 0} items`
});

registerTool('list_dir', {
    icon: '📁',
    iconAscii: '[L]',
    title: 'List Dir',
    color: colors.muted,
    renderSummary: (args) => args?.DirectoryPath || '.',
    renderDetails: (args, result) => `${result?.children?.length || 0} items`
});

// TODO/task tool
registerTool('todowrite', {
    icon: '✅',
    iconAscii: '[T]',
    title: 'Tasks',
    color: 'green',
    renderSummary: (args) => {
        const todos = args?.todos || [];
        const done = todos.filter(t => t.status === 'done').length;
        return `${done}/${todos.length} done`;
    },
    renderDetails: (args) => {
        const todos = args?.todos || [];
        return todos.map(t =>
            `[${t.status === 'done' ? 'x' : t.status === 'in_progress' ? '/' : ' '}] ${t.text}`
        ).join('\n');
    }
});

// Web search tool
registerTool('web_search', {
    icon: '🌐',
    iconAscii: '[W]',
    title: 'Web Search',
    color: colors.accent,
    renderSummary: (args) => args?.query || 'searching...',
    renderDetails: (args, result) => result?.summary?.slice(0, 300) || ''
});

// Browser tool
registerTool('browser', {
    icon: '🌐',
    iconAscii: '[B]',
    title: 'Browser',
    color: colors.accent,
    renderSummary: (args) => args?.url || 'browsing...',
    renderDetails: () => ''
});

/**
 * ToolBlock Component - Renders a tool invocation
 */
export const ToolBlock = ({
    toolName,
    args = {},
    status = 'running', // running | done | failed
    result = null,
    isExpanded = false,
    width = 80
}) => {
    const caps = getCapabilities();
    const renderer = getToolRenderer(toolName);
    const railChar = caps.unicodeOK ? '│' : '|';
    const toolIcon = caps.unicodeOK ? renderer.icon : renderer.iconAscii;

    const statusConfig = {
        running: { color: renderer.color, showSpinner: true },
        done: { color: colors.success, showSpinner: false },
        failed: { color: colors.error, showSpinner: false }
    };
    const config = statusConfig[status] || statusConfig.running;

    // Summary line
    const summary = renderer.renderSummary(args, status);

    return h(Box, { flexDirection: 'column' },
        // Header line
        h(Box, { flexDirection: 'row' },
            h(Text, { color: 'magenta' }, railChar + ' '),
            config.showSpinner
                ? h(Spinner, { type: 'dots' })
                : h(Text, { color: config.color }, toolIcon),
            h(Text, {}, ' '),
            h(Text, { color: config.color, bold: true }, renderer.title),
            h(Text, { color: colors.muted }, ': '),
            h(Text, { color: colors.muted, wrap: 'truncate' },
                summary.length > width - 25 ? summary.slice(0, width - 28) + '...' : summary
            )
        ),

        // Details (if expanded)
        isExpanded && result ? h(Box, { paddingLeft: 4 },
            h(Text, { color: colors.muted, dimColor: true, wrap: 'wrap' },
                renderer.renderDetails(args, result).slice(0, 500)
            )
        ) : null
    );
};

export default { registerTool, getToolRenderer, ToolBlock };
