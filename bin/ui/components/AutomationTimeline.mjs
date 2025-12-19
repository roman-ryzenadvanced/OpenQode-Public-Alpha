/**
 * Automation Timeline Component
 * 
 * Shows Observe → Intent → Actions → Verify for each automation step
 * 
 * Credits: Windows-Use verification loop, Browser-Use agent
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../../tui-theme.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

// Step phases
export const STEP_PHASES = {
    OBSERVE: 'observe',
    INTENT: 'intent',
    ACTIONS: 'actions',
    VERIFY: 'verify'
};

/**
 * Single timeline step
 */
const TimelineStep = ({
    stepNumber,
    observe = null,     // "What I see now"
    intent = null,      // "What I'm trying next"
    actions = [],       // Array of action descriptions
    verify = null,      // { passed, message }
    isActive = false,
    isExpanded = false,
    width = 60
}) => {
    const caps = getCapabilities();
    const railV = caps.unicodeOK ? '│' : '|';
    const bullet = caps.unicodeOK ? '●' : '*';
    const checkmark = caps.unicodeOK ? '✓' : '+';
    const crossmark = caps.unicodeOK ? '✗' : 'X';

    // Collapsed view: just step number + status
    if (!isExpanded && !isActive) {
        const status = verify
            ? (verify.passed ? 'passed' : 'failed')
            : 'pending';
        const statusIcon = verify?.passed ? checkmark : (verify ? crossmark : '…');
        const statusColor = verify?.passed ? colors.success : (verify ? colors.error : colors.muted);

        return h(Box, { flexDirection: 'row' },
            h(Text, { color: colors.muted }, `Step ${stepNumber}: `),
            h(Text, { color: statusColor }, statusIcon),
            h(Text, { color: colors.muted, dimColor: true },
                intent ? ` ${intent.slice(0, width - 20)}` : ''
            )
        );
    }

    // Expanded/active view
    return h(Box, { flexDirection: 'column', marginY: 0 },
        // Step header
        h(Box, { flexDirection: 'row' },
            h(Text, { color: isActive ? colors.accent : colors.muted, bold: isActive },
                `Step ${stepNumber}`
            ),
            isActive ? h(Box, { marginLeft: 1 },
                h(Spinner, { type: 'dots' })
            ) : null
        ),

        // Observe section
        observe ? h(Box, { flexDirection: 'row', paddingLeft: 2 },
            h(Text, { color: 'cyan' }, `${railV} Observe: `),
            h(Text, { color: colors.muted, wrap: 'truncate' },
                observe.slice(0, width - 15)
            )
        ) : null,

        // Intent section
        intent ? h(Box, { flexDirection: 'row', paddingLeft: 2 },
            h(Text, { color: 'yellow' }, `${railV} Intent: `),
            h(Text, { color: colors.fg }, intent.slice(0, width - 15))
        ) : null,

        // Actions section
        actions.length > 0 ? h(Box, { flexDirection: 'column', paddingLeft: 2 },
            h(Text, { color: 'magenta' }, `${railV} Actions:`),
            ...actions.slice(0, 5).map((action, i) =>
                h(Text, { key: i, color: colors.muted, dimColor: true },
                    `${railV}   ${i + 1}. ${action.slice(0, width - 10)}`
                )
            ),
            actions.length > 5 ? h(Text, { color: colors.muted, dimColor: true },
                `${railV}   +${actions.length - 5} more`
            ) : null
        ) : null,

        // Verify section
        verify ? h(Box, { flexDirection: 'row', paddingLeft: 2 },
            h(Text, { color: verify.passed ? colors.success : colors.error },
                `${railV} Verify: ${verify.passed ? checkmark : crossmark} `
            ),
            h(Text, { color: colors.muted }, verify.message || '')
        ) : null
    );
};

/**
 * Automation Timeline
 * 
 * Props:
 * - steps: array of step objects
 * - activeStepIndex: currently executing step (-1 if none)
 * - isExpanded: show all details
 * - width: available width
 */
const AutomationTimeline = ({
    steps = [],
    activeStepIndex = -1,
    isExpanded = false,
    title = 'Automation',
    width = 80
}) => {
    const caps = getCapabilities();

    if (steps.length === 0) return null;

    // Count stats
    const verified = steps.filter(s => s.verify?.passed).length;
    const failed = steps.filter(s => s.verify && !s.verify.passed).length;
    const pending = steps.length - verified - failed;

    return h(Box, { flexDirection: 'column' },
        // Header with stats
        h(Box, { flexDirection: 'row', marginBottom: 0 },
            h(Text, { color: colors.muted, bold: true }, `${title} `),
            h(Text, { color: colors.success }, `${verified}✓ `),
            failed > 0 ? h(Text, { color: colors.error }, `${failed}✗ `) : null,
            pending > 0 ? h(Text, { color: colors.muted }, `${pending}… `) : null
        ),

        // Steps
        ...steps.map((step, i) =>
            h(TimelineStep, {
                key: i,
                stepNumber: i + 1,
                observe: step.observe,
                intent: step.intent,
                actions: step.actions || [],
                verify: step.verify,
                isActive: i === activeStepIndex,
                isExpanded: isExpanded || i === activeStepIndex,
                width: width - 4
            })
        )
    );
};

export default AutomationTimeline;
export { AutomationTimeline, TimelineStep };
