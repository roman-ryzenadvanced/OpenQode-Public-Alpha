/**
 * Header Strip Component - Fixed-height session header
 * 
 * Based on sst/opencode header pattern
 * Credit: https://github.com/sst/opencode
 * 
 * Shows: session title + context tokens + cost
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../../tui-theme.mjs';
import { icon } from '../../icons.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

/**
 * HeaderStrip - Top fixed-height zone
 * 
 * Props:
 * - sessionName: current session/project name
 * - tokens: token count (in/out)
 * - cost: optional cost display
 * - isConnected: API connection status
 * - width: strip width
 */
const HeaderStrip = ({
    sessionName = 'OpenQode',
    agentMode = 'build',
    model = null,
    tokens = { in: 0, out: 0 },
    cost = null,
    isConnected = true,
    isThinking = false,
    width = 80
}) => {
    const caps = getCapabilities();
    const separator = caps.unicodeOK ? '│' : '|';
    const dotIcon = caps.unicodeOK ? '●' : '*';

    // Format token count
    const tokenStr = tokens.in > 0 || tokens.out > 0
        ? `${Math.round(tokens.in / 1000)}k/${Math.round(tokens.out / 1000)}k`
        : null;

    // Format cost
    const costStr = cost ? `$${cost.toFixed(4)}` : null;

    return h(Box, {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: width,
        height: 1,
        flexShrink: 0,
        paddingX: 1
    },
        // Left: Session name + agent mode
        h(Box, { flexDirection: 'row' },
            h(Text, { color: colors.accent, bold: true }, sessionName),
            h(Text, { color: colors.muted }, ` ${separator} `),
            h(Text, { color: 'magenta' }, agentMode.toUpperCase()),

            // Thinking indicator (if active)
            isThinking ? h(Box, { flexDirection: 'row', marginLeft: 1 },
                h(Spinner, { type: 'dots' }),
                h(Text, { color: 'yellow' }, ' thinking...')
            ) : null
        ),

        // Right: Stats
        h(Box, { flexDirection: 'row' },
            // Model name
            model ? h(Text, { color: colors.muted, dimColor: true },
                model.length > 15 ? model.slice(0, 13) + '…' : model
            ) : null,
            model && tokenStr ? h(Text, { color: colors.muted }, ` ${separator} `) : null,

            // Token count
            tokenStr ? h(Text, { color: colors.muted }, tokenStr) : null,
            tokenStr && costStr ? h(Text, { color: colors.muted }, ` ${separator} `) : null,

            // Cost
            costStr ? h(Text, { color: colors.success }, costStr) : null,

            // Connection indicator
            h(Text, { color: colors.muted }, ` ${separator} `),
            h(Text, { color: isConnected ? colors.success : colors.error }, dotIcon)
        )
    );
};

export default HeaderStrip;
export { HeaderStrip };
