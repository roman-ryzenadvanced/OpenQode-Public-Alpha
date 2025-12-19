/**
 * Footer Strip Component - Fixed-height session footer
 * 
 * Based on sst/opencode footer pattern
 * Credit: https://github.com/sst/opencode
 * 
 * Shows: cwd + status counters + hints
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../tui-theme.mjs';
import { icon } from '../../icons.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';
import path from 'path';

const h = React.createElement;

/**
 * FooterStrip - Bottom fixed-height zone
 * 
 * Props:
 * - cwd: current working directory
 * - gitBranch: current git branch
 * - messageCount: number of messages
 * - toolCount: number of tool calls
 * - errorCount: number of errors
 * - hints: array of hint strings
 * - width: strip width
 */
const FooterStrip = ({
    cwd = null,
    gitBranch = null,
    messageCount = 0,
    toolCount = 0,
    errorCount = 0,
    hints = [],
    showDetails = false,
    showThinking = false,
    width = 80
}) => {
    const caps = getCapabilities();
    const separator = caps.unicodeOK ? '│' : '|';
    const branchIcon = caps.unicodeOK ? '' : '@';
    const msgIcon = caps.unicodeOK ? '💬' : 'M';
    const toolIcon = caps.unicodeOK ? '⚙' : 'T';
    const errIcon = caps.unicodeOK ? '✗' : 'X';

    // Truncate cwd for display
    const cwdDisplay = cwd
        ? (cwd.length > 30 ? '…' + cwd.slice(-28) : cwd)
        : '.';

    return h(Box, {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: width,
        height: 1,
        flexShrink: 0,
        paddingX: 1
    },
        // Left: CWD + branch
        h(Box, { flexDirection: 'row' },
            h(Text, { color: colors.muted }, cwdDisplay),
            gitBranch ? h(Text, { color: colors.muted }, ` ${branchIcon}${gitBranch}`) : null
        ),

        // Center: Toggle status
        h(Box, { flexDirection: 'row' },
            h(Text, { color: showDetails ? colors.success : colors.muted, dimColor: !showDetails },
                'details'
            ),
            h(Text, { color: colors.muted }, ' '),
            h(Text, { color: showThinking ? colors.success : colors.muted, dimColor: !showThinking },
                'thinking'
            )
        ),

        // Right: Counters
        h(Box, { flexDirection: 'row' },
            // Messages
            h(Text, { color: colors.muted }, msgIcon + ' '),
            h(Text, { color: colors.muted }, String(messageCount)),
            h(Text, { color: colors.muted }, ` ${separator} `),

            // Tools
            h(Text, { color: colors.muted }, toolIcon + ' '),
            h(Text, { color: colors.muted }, String(toolCount)),

            // Errors (only if > 0)
            errorCount > 0 ? h(Box, { flexDirection: 'row' },
                h(Text, { color: colors.muted }, ` ${separator} `),
                h(Text, { color: colors.error }, errIcon + ' '),
                h(Text, { color: colors.error }, String(errorCount))
            ) : null
        )
    );
};

export default FooterStrip;
export { FooterStrip };
