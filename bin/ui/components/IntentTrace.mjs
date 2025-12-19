/**
 * IntentTrace Component - Premium thinking display
 * 
 * DESIGN:
 * - Default: hidden or 1-line summary
 * - When shown: Intent / Next / Why + "+N more"
 * - Never spam raw logs into transcript
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../../tui-theme.mjs';
import { icon } from '../../icons.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

/**
 * IntentTrace - Collapsible thinking summary
 * 
 * Props:
 * - intent: current intent (1 line)
 * - next: next action (1 line)
 * - why: optional reasoning (1 line)
 * - steps: array of step strings
 * - isThinking: show spinner
 * - verbosity: 'off' | 'brief' | 'detailed'
 */
const IntentTrace = ({
    intent = null,
    next = null,
    why = null,
    steps = [],
    isThinking = false,
    verbosity = 'brief',
    width = 80
}) => {
    const caps = getCapabilities();
    const [expanded, setExpanded] = useState(false);

    // Off mode = nothing shown
    if (verbosity === 'off' && !isThinking) return null;

    const railChar = caps.unicodeOK ? '┊' : ':';
    const railColor = colors.muted;

    // Brief mode: just intent + next
    if (verbosity === 'brief' || !expanded) {
        return h(Box, {
            flexDirection: 'column',
            marginY: 0
        },
            // Header with spinner
            h(Box, { flexDirection: 'row' },
                h(Text, { color: railColor, dimColor: true }, railChar + ' '),
                isThinking ? h(Spinner, { type: 'dots' }) : null,
                isThinking ? h(Text, {}, ' ') : null,
                h(Text, { color: colors.muted, dimColor: true },
                    isThinking ? 'thinking...' : 'thought'
                )
            ),

            // Intent line
            intent ? h(Box, { flexDirection: 'row' },
                h(Text, { color: railColor, dimColor: true }, railChar + '  '),
                h(Text, { color: colors.muted, bold: true }, 'Intent: '),
                h(Text, { color: colors.muted },
                    intent.length > width - 15 ? intent.slice(0, width - 18) + '...' : intent
                )
            ) : null,

            // Next line
            next ? h(Box, { flexDirection: 'row' },
                h(Text, { color: railColor, dimColor: true }, railChar + '  '),
                h(Text, { color: colors.muted, bold: true }, 'Next: '),
                h(Text, { color: colors.muted },
                    next.length > width - 13 ? next.slice(0, width - 16) + '...' : next
                )
            ) : null,

            // Expand hint (if more steps)
            steps.length > 0 ? h(Box, { flexDirection: 'row' },
                h(Text, { color: railColor, dimColor: true }, railChar + '  '),
                h(Text, { color: colors.muted, dimColor: true },
                    `+${steps.length} more`
                )
            ) : null
        );
    }

    // Detailed mode: show all
    return h(Box, { flexDirection: 'column', marginY: 0 },
        // Header
        h(Box, { flexDirection: 'row' },
            h(Text, { color: railColor, dimColor: true }, railChar + ' '),
            isThinking ? h(Spinner, { type: 'dots' }) : null,
            isThinking ? h(Text, {}, ' ') : null,
            h(Text, { color: colors.muted }, 'Intent Trace')
        ),

        // Intent
        intent ? h(Box, { flexDirection: 'row' },
            h(Text, { color: railColor, dimColor: true }, railChar + '  '),
            h(Text, { color: colors.accent }, 'Intent: '),
            h(Text, { color: colors.fg }, intent)
        ) : null,

        // Next
        next ? h(Box, { flexDirection: 'row' },
            h(Text, { color: railColor, dimColor: true }, railChar + '  '),
            h(Text, { color: colors.accent }, 'Next: '),
            h(Text, { color: colors.fg }, next)
        ) : null,

        // Why
        why ? h(Box, { flexDirection: 'row' },
            h(Text, { color: railColor, dimColor: true }, railChar + '  '),
            h(Text, { color: colors.muted }, 'Why: '),
            h(Text, { color: colors.muted }, why)
        ) : null,

        // Steps
        ...steps.map((step, i) =>
            h(Box, { key: i, flexDirection: 'row' },
                h(Text, { color: railColor, dimColor: true }, railChar + '  '),
                h(Text, { color: colors.muted, dimColor: true }, `${i + 1}. ${step}`)
            )
        ),
        // Collapse hint
        h(Box, { flexDirection: 'row' },
            h(Text, { color: railColor, dimColor: true }, railChar + '  '),
            h(Text, { color: colors.muted, dimColor: true }, '[collapse]')
        )
    );
};

export default IntentTrace;
export { IntentTrace };
