/**
 * Browser Inspector - Browser-Use inspired
 * 
 * Shows: URL, title, tabs, page stats, interactive elements
 * 
 * Credit: https://github.com/browser-use/browser-use
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../tui-theme.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

/**
 * Browser Inspector Component
 */
const BrowserInspector = ({
    url = null,
    title = null,
    tabs = [],
    pageInfo = null,
    pageStats = null,
    interactiveElements = [],
    screenshot = null,
    isExpanded = false,
    width = 40
}) => {
    const caps = getCapabilities();
    const [expanded, setExpanded] = useState(isExpanded);

    // Truncate URL for display
    const displayUrl = url
        ? (url.length > width - 10 ? url.slice(0, width - 13) + '...' : url)
        : 'No page';

    // Collapsed view
    if (!expanded) {
        return h(Box, { flexDirection: 'row' },
            h(Text, { color: colors.muted, bold: true }, '🌐 Browser: '),
            h(Text, { color: colors.accent }, displayUrl)
        );
    }

    // Expanded view
    return h(Box, { flexDirection: 'column', width },
        // Header
        h(Text, { color: colors.accent, bold: true }, '🌐 Browser Inspector'),

        // URL
        h(Box, { flexDirection: 'row', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'URL: '),
            h(Text, { color: colors.accent }, displayUrl)
        ),

        // Title
        title ? h(Box, { flexDirection: 'row', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'Title: '),
            h(Text, { color: colors.fg }, title.slice(0, width - 10))
        ) : null,

        // Tabs
        tabs.length > 0 ? h(Box, { flexDirection: 'column', paddingLeft: 1 },
            h(Text, { color: colors.muted }, `Tabs (${tabs.length}):`),
            ...tabs.slice(0, 3).map((tab, i) =>
                h(Text, { key: i, color: colors.muted, dimColor: true },
                    `  ${i + 1}. ${(tab.title || tab.url || '').slice(0, width - 8)}`
                )
            ),
            tabs.length > 3
                ? h(Text, { color: colors.muted, dimColor: true }, `  +${tabs.length - 3} more`)
                : null
        ) : null,

        // Page stats
        pageStats ? h(Box, { flexDirection: 'row', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'Stats: '),
            h(Text, { color: colors.muted, dimColor: true },
                `${pageStats.links || 0} links, ${pageStats.buttons || 0} buttons, ${pageStats.inputs || 0} inputs`
            )
        ) : null,

        // Interactive elements (first 5)
        interactiveElements.length > 0 ? h(Box, { flexDirection: 'column', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'Elements:'),
            ...interactiveElements.slice(0, 5).map((el, i) =>
                h(Text, { key: i, color: colors.muted, dimColor: true },
                    `  [${el.id || i}] ${el.tag}: ${(el.text || el.name || '').slice(0, 25)}`
                )
            ),
            interactiveElements.length > 5
                ? h(Text, { color: colors.muted, dimColor: true }, `  +${interactiveElements.length - 5} more`)
                : null
        ) : null,

        // Screenshot link
        screenshot ? h(Box, { flexDirection: 'row', paddingLeft: 1 },
            h(Text, { color: colors.muted }, '📷 '),
            h(Text, { color: colors.accent, underline: true }, 'View screenshot')
        ) : null
    );
};

export default BrowserInspector;
export { BrowserInspector };
