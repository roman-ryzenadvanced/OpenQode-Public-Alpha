/**
 * Premium Sidebar Component
 * 
 * DESIGN PRINCIPLES:
 * 1. NO nested borders (one-frame rule)
 * 2. Three clean sections: Project, Session, Shortcuts
 * 3. Headers + subtle dividers (not boxed widgets)
 * 4. Consistent typography and alignment
 * 5. ASCII-safe icons
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import path from 'path';
import { theme, colors, layout } from '../../tui-theme.mjs';
import { icon, roleIcon } from '../../icons.mjs';
import { getCapabilities, PROFILE } from '../../terminal-profile.mjs';
import FileTree from './FileTree.mjs';

const h = React.createElement;

/**
 * Section Header (no border, just styled text)
 */
const SectionHeader = ({ title, color = colors.muted }) => {
    return h(Text, { color, bold: true }, title);
};

/**
 * Divider line (subtle, no heavy borders)
 */
const Divider = ({ width, color = colors.border }) => {
    const caps = getCapabilities();
    const char = caps.unicodeOK ? '─' : '-';
    return h(Text, { color, dimColor: true }, char.repeat(Math.max(1, width)));
};

/**
 * Label-Value row (consistent alignment)
 */
const LabelValue = ({ label, value, valueColor = colors.fg }) => {
    return h(Box, { flexDirection: 'row' },
        h(Text, { color: colors.muted }, `${label}: `),
        h(Text, { color: valueColor }, value)
    );
};

/**
 * Toggle indicator (ON/OFF)
 */
const Toggle = ({ label, value, onColor = 'green' }) => {
    return h(Box, { flexDirection: 'row' },
        h(Text, { color: colors.muted }, `${label} `),
        value
            ? h(Text, { color: onColor }, 'ON')
            : h(Text, { color: colors.muted, dimColor: true }, 'off')
    );
};

/**
 * Status chip (single line, minimal)
 */
const StatusChip = ({ message, type = 'info', showSpinner = false }) => {
    const chipColor = type === 'error' ? colors.error
        : type === 'success' ? colors.success
            : type === 'warning' ? colors.warning
                : colors.accent;

    return h(Box, { flexDirection: 'row' },
        showSpinner ? h(Text, { color: 'gray', dimColor: true }, '...') : null,
        showSpinner ? h(Text, {}, ' ') : null,
        h(Text, { color: chipColor, wrap: 'truncate' }, message)
    );
};

/**
 * Premium Sidebar - Clean 3-section layout
 */
const PremiumSidebar = ({
    // Project info
    project,
    gitBranch,

    // Session info
    agent,
    activeModel,

    // Feature toggles
    contextEnabled = false,
    multiAgentEnabled = false,
    exposedThinking = false,
    soloMode = false,
    autoApprove = false,

    // Status indicators
    systemStatus = null,
    iqStatus = null,
    thinkingStats = null,
    indexStatus = null,

    // Layout
    width = 24,
    height = 0,

    // Explorer
    showFileManager = false,
    explorerRoot = null,
    selectedFiles = new Set(),
    onToggleFile = null,
    onOpenFile = null,
    recentFiles = [],
    hotFiles = [],

    // Interaction
    isFocused = false,
    showHint = false,
    reduceMotion = true
}) => {
    if (width === 0) return null;

    const caps = getCapabilities();
    const contentWidth = Math.max(10, width - 2);

    // Truncate helper
    const truncate = (str, len) => {
        if (!str) return '';
        return str.length > len ? str.slice(0, len - 1) + '…' : str;
    };

    // Derived values
    const projectName = project ? truncate(path.basename(project), contentWidth) : 'None';
    const branchName = truncate(gitBranch || 'main', contentWidth);
    const agentName = (agent || 'build').toUpperCase();
    const modelName = activeModel?.name || 'Not connected';

    // Streaming stats
    const isStreaming = thinkingStats?.chars > 0;

    const explorerHeight = Math.max(8, Math.min(22, (height || 0) - 24));

    return h(Box, {
        flexDirection: 'column',
        width: width,
        paddingX: 1,
        flexShrink: 0
    },
        // ═══════════════════════════════════════════════════════════
        // BRANDING - Minimal, not animated
        // ═══════════════════════════════════════════════════════════
        h(Text, { color: colors.accent, bold: true }, 'OpenQode'),
        h(Text, { color: colors.muted }, `${agentName} ${icon('branch')} ${branchName}`),

        h(Box, { marginTop: 1 }),

        // ═══════════════════════════════════════════════════════════
        // SECTION 1: PROJECT
        // ═══════════════════════════════════════════════════════════
        h(SectionHeader, { title: 'PROJECT' }),
        h(Divider, { width: contentWidth }),

        h(LabelValue, { label: icon('folder'), value: projectName }),
        h(LabelValue, { label: icon('branch'), value: branchName }),

        // System status (if any)
        systemStatus ? h(StatusChip, {
            message: systemStatus.message,
            type: systemStatus.type
        }) : null,

        // Index status (if any)
        indexStatus ? h(StatusChip, {
            message: indexStatus.message,
            type: indexStatus.type
        }) : null,

        // IQ Exchange status (if active)
        iqStatus ? h(StatusChip, {
            message: iqStatus.message || 'Processing...',
            type: 'info',
            showSpinner: true
        }) : null,

        h(Box, { marginTop: 1 }),

        // ═══════════════════════════════════════════════════════════
        // SECTION 2: SESSION
        // ═══════════════════════════════════════════════════════════
        h(SectionHeader, { title: 'SESSION' }),
        h(Divider, { width: contentWidth }),

        h(LabelValue, {
            label: icon('model'),
            value: truncate(modelName, contentWidth - 3),
            valueColor: activeModel?.isFree ? colors.success : colors.accent
        }),

        // Streaming indicator (only when active)
        isStreaming ? h(Box, { flexDirection: 'row' },
            reduceMotion ? h(Text, { color: colors.muted, dimColor: true }, '...') : h(Spinner, { type: 'dots' }),
            h(Text, { color: colors.muted }, ` ${thinkingStats.chars} chars`)
        ) : null,

        // Feature toggles (compact row)
        h(Box, { marginTop: 1, flexDirection: 'column' },
            h(Toggle, { label: 'Ctx', value: contextEnabled }),
            h(Toggle, { label: 'Multi', value: multiAgentEnabled }),
            h(Toggle, { label: 'Think', value: exposedThinking }),
            soloMode ? h(Toggle, { label: 'SmartX', value: soloMode, onColor: 'magenta' }) : null,
            autoApprove ? h(Toggle, { label: 'Auto', value: autoApprove, onColor: 'yellow' }) : null
        ),

        h(Box, { marginTop: 1 }),

        // ═══════════════════════════════════════════════════════════
        // SECTION 3: SHORTCUTS
        // ═══════════════════════════════════════════════════════════
        h(SectionHeader, { title: 'SHORTCUTS' }),
        h(Divider, { width: contentWidth }),

        h(Text, { color: colors.accent }, '/help'),
        h(Text, { color: colors.muted }, '/settings'),
        h(Text, { color: colors.muted }, '/theme'),
        h(Text, { color: colors.muted, dimColor: true }, 'Ctrl+P commands'),
        h(Text, { color: colors.muted, dimColor: true }, 'Ctrl+E explorer'),
        h(Text, { color: colors.muted, dimColor: true }, 'Ctrl+R recent'),
        h(Text, { color: colors.muted, dimColor: true }, 'Ctrl+H hot'),

        // Focus hint
        showHint ? h(Box, { marginTop: 1 },
            h(Text, { color: colors.muted, dimColor: true }, '[Tab] browse files')
        ) : null
        ,

        // SECTION 4: EXPLORER (IDE-style file tree)
        explorerRoot ? h(Box, { marginTop: 1, flexDirection: 'column' },
        h(SectionHeader, { title: 'EXPLORER' }),
        h(Divider, { width: contentWidth }),
        !showFileManager ? h(Text, { color: colors.muted, dimColor: true, wrap: 'truncate' }, 'Hidden (Ctrl+E or /explorer on)') : null,
            showFileManager && recentFiles && recentFiles.length > 0 ? h(Box, { flexDirection: 'column', marginBottom: 1 },
                h(Text, { color: colors.muted, dimColor: true }, 'Recent:'),
                recentFiles.slice(0, 3).map((f) => h(Text, { key: `recent:${f}`, color: colors.muted, wrap: 'truncate' }, `  ${f}`))
            ) : null,
            showFileManager && hotFiles && hotFiles.length > 0 ? h(Box, { flexDirection: 'column', marginBottom: 1 },
                h(Text, { color: colors.muted, dimColor: true }, 'Hot:'),
                hotFiles.slice(0, 3).map((f) => h(Text, { key: `hot:${f}`, color: colors.muted, wrap: 'truncate' }, `  ${f}`))
            ) : null,
            showFileManager && h(FileTree, {
                rootPath: explorerRoot,
                selectedFiles,
                onSelect: onToggleFile,
                onOpen: onOpenFile,
                isActive: Boolean(isFocused),
                height: explorerHeight,
                width: contentWidth
            }),
            h(Text, { color: colors.muted, dimColor: true }, '↑↓ navigate • Enter open • Space select')
        ) : null
    );
};

export default PremiumSidebar;
export { PremiumSidebar, SectionHeader, Divider, LabelValue, Toggle, StatusChip };
