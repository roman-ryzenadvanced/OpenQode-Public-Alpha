/**
 * Premium Message Component
 * 
 * DESIGN PRINCIPLES:
 * 1. Single rail-based layout for ALL roles (user, assistant, system, tool, error)
 * 2. NO message borders - uses left rail + role label line + body
 * 3. Max readable line width (clamped)
 * 4. Width-aware wrapping
 * 5. ASCII-safe icons
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors, layout } from '../../tui-theme.mjs';
import { icon, roleIcon } from '../../icons.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

/**
 * Rail character for message left border
 */
const getRailChar = (isStreaming = false) => {
    const caps = getCapabilities();
    if (!caps.unicodeOK) return '|';
    return isStreaming ? '┃' : '│';
};

/**
 * Get rail color by role
 */
const getRailColor = (role) => {
    const roleColors = {
        user: colors.rail.user,
        assistant: colors.rail.assistant,
        system: colors.rail.system,
        tool: colors.rail.tool,
        error: colors.rail.error,
        thinking: colors.rail.thinking
    };
    return roleColors[role] || colors.muted;
};

/**
 * Role label (first line of message)
 */
const RoleLabel = ({ role, isStreaming = false, timestamp = null }) => {
    const caps = getCapabilities();
    const labels = {
        user: 'You',
        assistant: 'Assistant',
        system: 'System',
        tool: 'Tool',
        error: 'Error',
        thinking: 'Thinking'
    };

    const label = labels[role] || role;
    const labelIcon = roleIcon(role);
    const color = getRailColor(role);

    return h(Box, { flexDirection: 'row' },
        h(Text, { color, bold: true }, `${labelIcon} ${label}`),
        isStreaming ? h(Box, { marginLeft: 1 },
            h(Spinner, { type: 'dots' }),
            h(Text, { color: colors.muted }, ' generating...')
        ) : null,
        timestamp ? h(Text, { color: colors.muted, dimColor: true, marginLeft: 1 }, timestamp) : null
    );
};

/**
 * Message body with proper wrapping
 */
const MessageBody = ({ content, width, color = colors.fg }) => {
    // Clamp width for readability
    const maxWidth = Math.min(width, layout.transcript.maxLineWidth);

    return h(Box, { flexDirection: 'column', width: maxWidth },
        h(Text, { color, wrap: 'wrap' }, content)
    );
};

/**
 * Status Chip for short system/tool messages
 * Single-line, minimal interruption
 */
const StatusChip = ({ message, type = 'info', showSpinner = false }) => {
    const chipColors = {
        info: colors.accent,
        success: colors.success,
        warning: colors.warning,
        error: colors.error
    };
    const chipColor = chipColors[type] || colors.muted;

    return h(Box, { flexDirection: 'row', marginY: 0 },
        h(Text, { color: colors.muted }, getRailChar()),
        h(Text, {}, ' '),
        showSpinner ? h(Spinner, { type: 'dots' }) : null,
        showSpinner ? h(Text, {}, ' ') : null,
        h(Text, { color: chipColor }, message)
    );
};

/**
 * Premium Message - Unified rail-based layout
 */
const PremiumMessage = ({
    role = 'assistant',
    content = '',
    isStreaming = false,
    timestamp = null,
    width = 80,
    // For tool messages
    toolName = null,
    isCollapsed = false,
    onToggle = null,
    // For status chips (short messages)
    isChip = false,
    chipType = 'info'
}) => {
    // Short status messages use chip style
    if (isChip || (role === 'system' && content.length < 60)) {
        return h(StatusChip, {
            message: content,
            type: chipType,
            showSpinner: isStreaming
        });
    }

    const railColor = getRailColor(role);
    const railChar = getRailChar(isStreaming);

    // Calculate body width (minus rail + spacing)
    const bodyWidth = Math.max(20, width - 4);

    return h(Box, {
        flexDirection: 'row',
        marginY: role === 'user' ? 1 : 0
    },
        // Left Rail
        h(Box, { width: 2, flexShrink: 0 },
            h(Text, { color: railColor }, railChar)
        ),

        // Content area
        h(Box, { flexDirection: 'column', flexGrow: 1, width: bodyWidth },
            // Role label line
            h(RoleLabel, {
                role,
                isStreaming,
                timestamp
            }),

            // Tool name (if applicable)
            toolName ? h(Text, { color: colors.muted, dimColor: true },
                `${icon('tool')} ${toolName}`
            ) : null,

            // Message body
            h(MessageBody, {
                content,
                width: bodyWidth,
                color: role === 'error' ? colors.error : colors.fg
            })
        )
    );
};

/**
 * Thinking Block - Collapsible intent trace
 */
const ThinkingBlock = ({
    lines = [],
    isThinking = false,
    showFull = false,
    width = 80
}) => {
    const visibleLines = showFull ? lines : lines.slice(-3);
    const hiddenCount = Math.max(0, lines.length - visibleLines.length);

    if (lines.length === 0 && !isThinking) return null;

    const railChar = getRailChar(isThinking);
    const railColor = getRailColor('thinking');

    return h(Box, {
        flexDirection: 'row',
        marginY: 0
    },
        // Left Rail
        h(Box, { width: 2, flexShrink: 0 },
            h(Text, { color: railColor, dimColor: true }, railChar)
        ),

        // Content
        h(Box, { flexDirection: 'column' },
            // Header
            h(Box, { flexDirection: 'row' },
                isThinking ? h(Spinner, { type: 'dots' }) : null,
                isThinking ? h(Text, {}, ' ') : null,
                h(Text, { color: colors.muted, dimColor: true },
                    isThinking ? 'thinking...' : 'thought'
                )
            ),

            // Visible lines
            ...visibleLines.map((line, i) =>
                h(Text, {
                    key: i,
                    color: colors.muted,
                    dimColor: true,
                    wrap: 'truncate'
                }, `  ${line.slice(0, width - 6)}`)
            ),

            // Hidden count
            hiddenCount > 0 ? h(Text, {
                color: colors.muted,
                dimColor: true
            }, `  +${hiddenCount} more`) : null
        )
    );
};

/**
 * Tool Call Card - Collapsed by default
 */
const ToolCard = ({
    name,
    status = 'running', // running, done, failed
    output = '',
    isExpanded = false,
    onToggle = null,
    width = 80
}) => {
    const statusColors = {
        running: colors.accent,
        done: colors.success,
        failed: colors.error
    };
    const statusIcons = {
        running: icon('running'),
        done: icon('done'),
        failed: icon('failed')
    };

    const railColor = colors.rail.tool;
    const railChar = getRailChar(status === 'running');

    return h(Box, {
        flexDirection: 'row',
        marginY: 0
    },
        // Left Rail
        h(Box, { width: 2, flexShrink: 0 },
            h(Text, { color: railColor }, railChar)
        ),

        // Content
        h(Box, { flexDirection: 'column' },
            // Header line
            h(Box, { flexDirection: 'row' },
                status === 'running' ? h(Spinner, { type: 'dots' }) : null,
                status === 'running' ? h(Text, {}, ' ') : null,
                h(Text, { color: statusColors[status] },
                    `${statusIcons[status]} ${name}`
                ),
                !isExpanded && output ? h(Text, { color: colors.muted, dimColor: true },
                    ` [${icon('expand')} expand]`
                ) : null
            ),

            // Expanded output
            isExpanded && output ? h(Box, { marginTop: 0, paddingLeft: 2 },
                h(Text, { color: colors.muted, wrap: 'wrap' }, output)
            ) : null
        )
    );
};

export default PremiumMessage;
export {
    PremiumMessage,
    StatusChip,
    ThinkingBlock,
    ToolCard,
    RoleLabel,
    MessageBody,
    getRailColor,
    getRailChar
};
