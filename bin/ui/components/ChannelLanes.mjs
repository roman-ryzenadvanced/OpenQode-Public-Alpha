/**
 * Channel Components - Separate lanes for different content types
 * 
 * CHANNEL SEPARATION:
 * - ChatLane: user + assistant prose only
 * - ToolLane: tool calls, auto-heal, IQ exchange (collapsed by default)
 * - ErrorLane: short summary + expandable details
 */

import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../../tui-theme.mjs';
import { icon } from '../../icons.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

/**
 * ToolLane - Collapsed tool/command output
 * Expands on demand, doesn't pollute chat
 */
const ToolLane = ({
    name,
    status = 'running', // running, done, failed
    summary = null,
    output = null,
    isExpanded = false,
    onToggle = null,
    width = 80
}) => {
    const caps = getCapabilities();
    const [expanded, setExpanded] = useState(isExpanded);

    useEffect(() => {
        setExpanded(isExpanded);
    }, [isExpanded]);

    const statusConfig = {
        running: { color: colors.accent, icon: null, showSpinner: true },
        done: { color: colors.success, icon: caps.unicodeOK ? '✓' : '+', showSpinner: false },
        failed: { color: colors.error, icon: caps.unicodeOK ? '✗' : 'X', showSpinner: false }
    };

    const config = statusConfig[status] || statusConfig.running;
    const railChar = caps.unicodeOK ? '│' : '|';

    // Header line (always shown)
    const header = h(Box, { flexDirection: 'row' },
        // Rail
        h(Text, { color: 'magenta' }, railChar + ' '),

        // Spinner or icon
        config.showSpinner
            ? h(Spinner, { type: 'dots' })
            : h(Text, { color: config.color }, config.icon),
        h(Text, {}, ' '),

        // Tool name
        h(Text, { color: config.color, bold: true }, name),

        // Summary (if any)
        summary ? h(Text, { color: colors.muted }, ` – ${summary}`) : null,

        // Expand hint (if has output)
        output && !expanded ? h(Text, { color: colors.muted, dimColor: true },
            ` [${caps.unicodeOK ? '▼' : 'v'} expand]`
        ) : null
    );

    if (!expanded || !output) {
        return header;
    }

    // Expanded view with output
    return h(Box, { flexDirection: 'column' },
        header,
        h(Box, { paddingLeft: 4, marginTop: 0, marginBottom: 1 },
            h(Text, {
                color: colors.muted,
                dimColor: true,
                wrap: 'wrap'
            }, output.length > 200 ? output.slice(0, 200) + '...' : output)
        )
    );
};

/**
 * ErrorLane - Compact error display
 * Short summary line + expandable details
 */
const ErrorLane = ({
    message,
    details = null,
    isExpanded = false,
    width = 80
}) => {
    const caps = getCapabilities();
    const [expanded, setExpanded] = useState(isExpanded);

    useEffect(() => {
        setExpanded(isExpanded);
    }, [isExpanded]);
    const railChar = caps.unicodeOK ? '│' : '|';
    const errorIcon = caps.unicodeOK ? '✗' : 'X';

    // Summary line (always shown)
    const summary = h(Box, { flexDirection: 'row' },
        h(Text, { color: colors.error }, railChar + ' '),
        h(Text, { color: colors.error }, errorIcon + ' '),
        h(Text, { color: colors.error, bold: true }, 'Error: '),
        h(Text, { color: colors.fg, wrap: 'truncate' },
            message.length > 60 ? message.slice(0, 57) + '...' : message
        ),
        details && !expanded ? h(Text, { color: colors.muted, dimColor: true },
            ` [${caps.unicodeOK ? '▼' : 'v'} details]`
        ) : null
    );

    if (!expanded || !details) {
        return summary;
    }

    // Expanded with details
    return h(Box, { flexDirection: 'column' },
        summary,
        h(Box, { paddingLeft: 4, marginTop: 0, marginBottom: 1 },
            h(Text, { color: colors.muted, wrap: 'wrap' }, details)
        )
    );
};

/**
 * SystemChip - Single-line system message
 * Minimal, doesn't interrupt conversation flow
 */
const SystemChip = ({ message, type = 'info' }) => {
    const caps = getCapabilities();
    const railChar = caps.unicodeOK ? '│' : '|';

    const typeConfig = {
        info: { color: colors.accent, icon: caps.unicodeOK ? 'ℹ' : 'i' },
        success: { color: colors.success, icon: caps.unicodeOK ? '✓' : '+' },
        warning: { color: colors.warning, icon: caps.unicodeOK ? '⚠' : '!' }
    };

    const config = typeConfig[type] || typeConfig.info;

    return h(Box, { flexDirection: 'row' },
        h(Text, { color: config.color, dimColor: true }, railChar + ' '),
        h(Text, { color: config.color, dimColor: true }, config.icon + ' '),
        h(Text, { color: colors.muted, dimColor: true }, message)
    );
};

/**
 * IQExchangeChip - IQ Exchange status (single line)
 */
const IQExchangeChip = ({ message, isActive = true }) => {
    const caps = getCapabilities();
    const railChar = caps.unicodeOK ? '│' : '|';

    return h(Box, { flexDirection: 'row' },
        h(Text, { color: 'magenta' }, railChar + ' '),
        isActive ? h(Spinner, { type: 'dots' }) : null,
        isActive ? h(Text, {}, ' ') : null,
        h(Text, { color: 'magenta', bold: true }, 'IQ Exchange: '),
        h(Text, { color: colors.muted }, message)
    );
};

export { ToolLane, ErrorLane, SystemChip, IQExchangeChip };
export default { ToolLane, ErrorLane, SystemChip, IQExchangeChip };
