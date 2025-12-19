/**
 * Flow Ribbon Component - "Ask → Preview → Run → Verify → Done"
 * 
 * NOOB-PROOF: Always shows current phase and what to do next
 * 
 * Credit: OpenCode-inspired phase ribbon
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../tui-theme.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

// Flow phases
export const FLOW_PHASES = {
    ASK: 'ask',
    PREVIEW: 'preview',
    RUN: 'run',
    VERIFY: 'verify',
    DONE: 'done'
};

// Phase display config
const PHASE_CONFIG = {
    [FLOW_PHASES.ASK]: {
        label: 'Ask',
        hint: 'Describe what you want to do',
        icon: '?'
    },
    [FLOW_PHASES.PREVIEW]: {
        label: 'Preview',
        hint: 'Review planned actions — Enter to run, or edit',
        icon: '⊙'
    },
    [FLOW_PHASES.RUN]: {
        label: 'Run',
        hint: 'Executing actions...',
        icon: '▶'
    },
    [FLOW_PHASES.VERIFY]: {
        label: 'Verify',
        hint: 'Checking results...',
        icon: '✓?'
    },
    [FLOW_PHASES.DONE]: {
        label: 'Done',
        hint: 'Task completed',
        icon: '✓'
    }
};

/**
 * Single phase pill
 */
const PhasePill = ({ phase, isActive, isPast, isFuture, useAscii }) => {
    const config = PHASE_CONFIG[phase];

    let color = colors.muted;
    let dimColor = true;

    if (isActive) {
        color = colors.accent;
        dimColor = false;
    } else if (isPast) {
        color = colors.success;
        dimColor = true;
    }

    const icon = useAscii
        ? (isActive ? '*' : isPast ? '+' : '-')
        : config.icon;

    return h(Box, { flexDirection: 'row' },
        h(Text, { color, dimColor, bold: isActive },
            `${icon} ${config.label}`
        )
    );
};

/**
 * Flow Ribbon - Shows current phase in workflow
 * 
 * Props:
 * - currentPhase: one of FLOW_PHASES
 * - showHint: whether to show "what to do next" hint
 * - width: ribbon width
 */
const FlowRibbon = ({
    currentPhase = FLOW_PHASES.ASK,
    showHint = true,
    width = 80
}) => {
    const caps = getCapabilities();
    const phases = Object.values(FLOW_PHASES);
    const currentIndex = phases.indexOf(currentPhase);

    const separator = caps.unicodeOK ? ' → ' : ' > ';
    const config = PHASE_CONFIG[currentPhase];

    return h(Box, {
        flexDirection: 'column',
        width: width
    },
        // Phase pills
        h(Box, { flexDirection: 'row' },
            ...phases.map((phase, i) => {
                const isActive = phase === currentPhase;
                const isPast = i < currentIndex;
                const isFuture = i > currentIndex;

                return h(Box, { key: phase, flexDirection: 'row' },
                    h(PhasePill, {
                        phase,
                        isActive,
                        isPast,
                        isFuture,
                        useAscii: !caps.unicodeOK
                    }),
                    i < phases.length - 1
                        ? h(Text, { color: colors.muted, dimColor: true }, separator)
                        : null
                );
            })
        ),

        // Hint line (what to do next)
        showHint && config.hint ? h(Box, { marginTop: 0 },
            h(Text, { color: colors.muted, dimColor: true },
                `↳ ${config.hint}`
            )
        ) : null
    );
};

export default FlowRibbon;
export { FlowRibbon, PHASE_CONFIG };
