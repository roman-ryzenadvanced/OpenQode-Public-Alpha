/**
 * Server Inspector - Ops Console
 * 
 * Shows: host, cwd, env, command queue, log tail
 * 
 * Credit: Based on ops console patterns
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../tui-theme.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

/**
 * Server Inspector Component
 */
const ServerInspector = ({
    host = null,
    user = null,
    cwd = null,
    env = {},
    commandQueue = [],
    logTail = [],
    lastExitCode = null,
    healthStatus = null,
    isExpanded = false,
    width = 40
}) => {
    const caps = getCapabilities();
    const [expanded, setExpanded] = useState(isExpanded);

    const checkmark = caps.unicodeOK ? '✓' : '+';
    const crossmark = caps.unicodeOK ? '✗' : 'X';

    // Collapsed view
    if (!expanded) {
        const statusIcon = healthStatus === 'healthy' ? checkmark :
            healthStatus === 'unhealthy' ? crossmark : '?';
        const statusColor = healthStatus === 'healthy' ? colors.success :
            healthStatus === 'unhealthy' ? colors.error : colors.muted;

        return h(Box, { flexDirection: 'row' },
            h(Text, { color: colors.muted, bold: true }, '🖥️ Server: '),
            h(Text, { color: colors.fg }, `${user || 'user'}@${host || 'localhost'}`),
            h(Text, { color: statusColor }, ` ${statusIcon}`)
        );
    }

    // Expanded view
    return h(Box, { flexDirection: 'column', width },
        // Header
        h(Text, { color: colors.accent, bold: true }, '🖥️ Server Inspector'),

        // Connection
        h(Box, { flexDirection: 'row', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'Host: '),
            h(Text, { color: colors.fg }, `${user || 'user'}@${host || 'localhost'}`)
        ),

        // CWD
        cwd ? h(Box, { flexDirection: 'row', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'CWD: '),
            h(Text, { color: colors.muted, dimColor: true }, cwd)
        ) : null,

        // Environment (if any interesting vars)
        Object.keys(env).length > 0 ? h(Box, { flexDirection: 'column', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'Env:'),
            ...Object.entries(env).slice(0, 3).map(([k, v], i) =>
                h(Text, { key: i, color: colors.muted, dimColor: true },
                    `  ${k}=${String(v).slice(0, 20)}`
                )
            )
        ) : null,

        // Command queue
        commandQueue.length > 0 ? h(Box, { flexDirection: 'column', paddingLeft: 1 },
            h(Text, { color: colors.muted }, `Queue (${commandQueue.length}):`),
            ...commandQueue.slice(0, 3).map((cmd, i) =>
                h(Text, { key: i, color: colors.muted, dimColor: true },
                    `  ${i + 1}. ${cmd.slice(0, width - 8)}`
                )
            )
        ) : null,

        // Log tail (last 5 lines)
        logTail.length > 0 ? h(Box, { flexDirection: 'column', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'Logs:'),
            ...logTail.slice(-5).map((line, i) =>
                h(Text, { key: i, color: colors.muted, dimColor: true },
                    `  ${line.slice(0, width - 4)}`
                )
            )
        ) : null,

        // Last exit code
        lastExitCode !== null ? h(Box, { flexDirection: 'row', paddingLeft: 1 },
            h(Text, { color: lastExitCode === 0 ? colors.success : colors.error },
                lastExitCode === 0 ? checkmark : crossmark
            ),
            h(Text, { color: colors.muted }, ` Exit: ${lastExitCode}`)
        ) : null,

        // Health status
        healthStatus ? h(Box, { flexDirection: 'row', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'Health: '),
            h(Text, { color: healthStatus === 'healthy' ? colors.success : colors.error },
                healthStatus
            )
        ) : null
    );
};

export default ServerInspector;
export { ServerInspector };
