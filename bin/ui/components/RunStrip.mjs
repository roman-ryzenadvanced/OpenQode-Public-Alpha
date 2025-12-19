/**
 * RunStrip Component
 * 
 * SINGLE STATE SURFACE: One place for all run state
 * - thinking / streaming / waiting / failed / idle
 * 
 * DESIGN:
 * - Compact single-line strip at top of main panel
 * - Shows: state • agent • model • cwd
 * - Never reflows, fixed height (1 row)
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../../tui-theme.mjs';
import { icon, statusIcon } from '../../icons.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

// Run states
const RUN_STATES = {
    IDLE: 'idle',
    THINKING: 'thinking',
    STREAMING: 'streaming',
    WAITING: 'waiting',
    TOOL: 'tool',
    FAILED: 'failed',
    SUCCESS: 'success'
};

/**
 * Get state display info
 */
const getStateDisplay = (state, message) => {
    const caps = getCapabilities();

    const displays = {
        [RUN_STATES.IDLE]: {
            icon: caps.unicodeOK ? '●' : '*',
            color: colors.success,
            text: 'Ready'
        },
        [RUN_STATES.THINKING]: {
            icon: null, // spinner 
            color: 'yellow',
            text: message || 'Thinking...',
            showSpinner: true
        },
        [RUN_STATES.STREAMING]: {
            icon: null,
            color: colors.accent,
            text: message || 'Generating...',
            showSpinner: true
        },
        [RUN_STATES.WAITING]: {
            icon: caps.unicodeOK ? '◐' : '~',
            color: 'yellow',
            text: message || 'Waiting...'
        },
        [RUN_STATES.TOOL]: {
            icon: null,
            color: 'magenta',
            text: message || 'Running tool...',
            showSpinner: true
        },
        [RUN_STATES.FAILED]: {
            icon: caps.unicodeOK ? '✗' : 'X',
            color: colors.error,
            text: message || 'Failed'
        },
        [RUN_STATES.SUCCESS]: {
            icon: caps.unicodeOK ? '✓' : '+',
            color: colors.success,
            text: message || 'Done'
        }
    };

    return displays[state] || displays[RUN_STATES.IDLE];
};

/**
 * RunStrip - Compact run state indicator
 * 
 * Props:
 * - state: one of RUN_STATES
 * - message: optional status message
 * - agent: current agent name
 * - model: current model name
 * - tokensPerSec: streaming speed
 * - width: strip width
 */
const RunStrip = ({
    state = RUN_STATES.IDLE,
    message = null,
    agent = null,
    model = null,
    tokensPerSec = 0,
    width = 80
}) => {
    const caps = getCapabilities();
    const display = getStateDisplay(state, message);
    const separator = caps.unicodeOK ? '│' : '|';

    // Build parts
    const parts = [];

    // State indicator
    if (display.showSpinner) {
        parts.push(h(Spinner, { key: 'spin', type: 'dots' }));
        parts.push(h(Text, { key: 'space1' }, ' '));
    } else if (display.icon) {
        parts.push(h(Text, { key: 'icon', color: display.color }, display.icon + ' '));
    }

    // State text
    parts.push(h(Text, { key: 'state', color: display.color }, display.text));

    // Tokens per second (only when streaming)
    if (state === RUN_STATES.STREAMING && tokensPerSec > 0) {
        parts.push(h(Text, { key: 'tps', color: colors.muted }, ` ${tokensPerSec} tok/s`));
    }

    // Separator + Agent
    if (agent) {
        parts.push(h(Text, { key: 'sep1', color: colors.muted }, ` ${separator} `));
        parts.push(h(Text, { key: 'agent', color: colors.muted }, agent.toUpperCase()));
    }

    // Separator + Model
    if (model) {
        parts.push(h(Text, { key: 'sep2', color: colors.muted }, ` ${separator} `));
        parts.push(h(Text, { key: 'model', color: colors.muted, dimColor: true },
            model.length > 20 ? model.slice(0, 18) + '…' : model
        ));
    }

    return h(Box, {
        flexDirection: 'row',
        width: width,
        height: 1,
        flexShrink: 0,
        paddingX: 1
    }, ...parts);
};

export default RunStrip;
export { RunStrip, RUN_STATES, getStateDisplay };
