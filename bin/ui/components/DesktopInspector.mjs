/**
 * Desktop Inspector - Windows-Use inspired
 * 
 * Shows: foreground app, cursor, apps list, interactive elements
 * 
 * Credit: https://github.com/CursorTouch/Windows-Use
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../tui-theme.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

/**
 * Desktop Inspector Component
 */
const DesktopInspector = ({
    foregroundApp = null,
    cursorPosition = null,
    runningApps = [],
    interactiveElements = [],
    lastScreenshot = null,
    lastVerification = null,
    isExpanded = false,
    width = 40
}) => {
    const caps = getCapabilities();
    const [expanded, setExpanded] = useState(isExpanded);

    const railV = caps.unicodeOK ? '│' : '|';
    const checkmark = caps.unicodeOK ? '✓' : '+';
    const crossmark = caps.unicodeOK ? '✗' : 'X';

    // Collapsed view
    if (!expanded) {
        return h(Box, { flexDirection: 'row' },
            h(Text, { color: colors.muted, bold: true }, '🖥️ Desktop: '),
            h(Text, { color: colors.fg }, foregroundApp || 'Unknown'),
            interactiveElements.length > 0
                ? h(Text, { color: colors.muted }, ` (${interactiveElements.length} elements)`)
                : null
        );
    }

    // Expanded view
    return h(Box, { flexDirection: 'column', width },
        // Header
        h(Text, { color: colors.accent, bold: true }, '🖥️ Desktop Inspector'),

        // Foreground app
        h(Box, { flexDirection: 'row', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'App: '),
            h(Text, { color: colors.fg }, foregroundApp || 'Unknown')
        ),

        // Cursor position
        cursorPosition ? h(Box, { flexDirection: 'row', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'Cursor: '),
            h(Text, { color: colors.muted }, `(${cursorPosition.x}, ${cursorPosition.y})`)
        ) : null,

        // Running apps (first 5)
        runningApps.length > 0 ? h(Box, { flexDirection: 'column', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'Apps:'),
            ...runningApps.slice(0, 5).map((app, i) =>
                h(Text, { key: i, color: colors.muted, dimColor: true }, `  ${i + 1}. ${app}`)
            ),
            runningApps.length > 5
                ? h(Text, { color: colors.muted, dimColor: true }, `  +${runningApps.length - 5} more`)
                : null
        ) : null,

        // Last screenshot path
        lastScreenshot ? h(Box, { flexDirection: 'column', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'Screenshot:'),
            h(Text, { color: colors.muted, dimColor: true, wrap: 'truncate' }, lastScreenshot)
        ) : null,

        // Interactive elements (first 5)
        interactiveElements.length > 0 ? h(Box, { flexDirection: 'column', paddingLeft: 1 },
            h(Text, { color: colors.muted }, 'Elements:'),
            ...interactiveElements.slice(0, 5).map((el, i) =>
                h(Text, { key: i, color: colors.muted, dimColor: true },
                    `  [${el.id || i}] ${el.type}: ${(el.text || '').slice(0, 20)}`
                )
            ),
            interactiveElements.length > 5
                ? h(Text, { color: colors.muted, dimColor: true }, `  +${interactiveElements.length - 5} more`)
                : null
        ) : null,

        // Last verification
        lastVerification ? h(Box, { flexDirection: 'row', paddingLeft: 1 },
            h(Text, { color: lastVerification.passed ? colors.success : colors.error },
                lastVerification.passed ? checkmark : crossmark
            ),
            h(Text, { color: colors.muted }, ` Verify: ${lastVerification.message || ''}`)
        ) : null
    );
};

export default DesktopInspector;
export { DesktopInspector };
