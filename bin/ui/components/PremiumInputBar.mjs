/**
 * Premium Input Bar Component
 * 
 * STABILITY RULES:
 * 1. Fixed height in ALL states (idle, streaming, approval, diff review)
 * 2. Minimal "generating" indicator (no height changes)
 * 3. Status strip above input (single line)
 * 4. Never causes layout shifts
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { colors, layout } from '../../tui-theme.mjs';
import { icon } from '../../icons.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

/**
 * Status Strip - Single line above input showing current state
 */
const StatusStrip = ({
    isStreaming = false,
    model = null,
    agent = null,
    cwd = null,
    tokensPerSec = 0
}) => {
    const caps = getCapabilities();
    const separator = caps.unicodeOK ? '│' : '|';

    const parts = [];

    // Streaming indicator
    if (isStreaming) {
        parts.push(h(Box, { key: 'stream', flexDirection: 'row' },
            h(Spinner, { type: 'dots' }),
            h(Text, { color: colors.accent }, ' generating')
        ));
        if (tokensPerSec > 0) {
            parts.push(h(Text, { key: 'tps', color: colors.muted }, ` ${tokensPerSec} tok/s`));
        }
    }

    // Model
    if (model) {
        parts.push(h(Text, { key: 'model', color: colors.muted }, ` ${separator} ${model}`));
    }

    // Agent
    if (agent) {
        parts.push(h(Text, { key: 'agent', color: colors.muted }, ` ${separator} ${agent}`));
    }

    return h(Box, {
        flexDirection: 'row',
        height: 1,
        paddingX: 1
    }, ...parts);
};

/**
 * Input Prompt - The actual text input with prompt icon
 */
const InputPrompt = ({
    value,
    onChange,
    onSubmit,
    placeholder = 'Type a message...',
    isDisabled = false,
    width = 80
}) => {
    const caps = getCapabilities();
    const promptIcon = caps.unicodeOK ? '❯' : '>';

    return h(Box, {
        flexDirection: 'row',
        paddingX: 1,
        height: 1
    },
        h(Text, { color: isDisabled ? colors.muted : colors.accent }, `${promptIcon} `),
        isDisabled
            ? h(Text, { color: colors.muted, dimColor: true }, 'waiting for response...')
            : h(TextInput, {
                value,
                onChange,
                onSubmit,
                placeholder,
                focus: true
            })
    );
};

/**
 * Action Hint - Shows keyboard shortcuts when relevant
 */
const ActionHint = ({ hints = [] }) => {
    if (hints.length === 0) return null;

    return h(Box, {
        flexDirection: 'row',
        height: 1,
        paddingX: 1,
        justifyContent: 'flex-end'
    },
        hints.map((hint, i) =>
            h(Text, { key: i, color: colors.muted, dimColor: true },
                i > 0 ? ' | ' : '',
                hint
            )
        )
    );
};

/**
 * Premium Input Bar - Fixed height, stable layout
 * 
 * Structure:
 * Row 1: Status strip (model, agent, streaming indicator)
 * Row 2: Input prompt with text input
 * Row 3: Action hints (context-sensitive)
 * 
 * Total: 3 rows ALWAYS
 */
const PremiumInputBar = ({
    // Input state
    value = '',
    onChange,
    onSubmit,
    placeholder = 'Type a message...',

    // Status
    isStreaming = false,
    isApprovalMode = false,
    isDiffMode = false,

    // Context
    model = null,
    agent = null,
    cwd = null,
    tokensPerSec = 0,

    // Layout
    width = 80
}) => {
    // Build context-sensitive hints
    const hints = [];
    if (isStreaming) {
        hints.push('type to interrupt');
    } else if (isApprovalMode) {
        hints.push('y: approve', 'n: reject');
    } else if (isDiffMode) {
        hints.push('a: apply', 's: skip', 'q: quit');
    } else {
        hints.push('/ for commands', 'Ctrl+P palette');
    }

    // Border character
    const caps = getCapabilities();
    const borderChar = caps.unicodeOK ? '─' : '-';

    return h(Box, {
        flexDirection: 'column',
        width: width,
        height: layout.inputBar.height, // FIXED HEIGHT
        borderStyle: undefined, // No nested borders
        flexShrink: 0
    },
        // Top border line
        h(Text, { color: colors.border, dimColor: true },
            borderChar.repeat(Math.min(width, 200))
        ),

        // Status strip
        h(StatusStrip, {
            isStreaming,
            model,
            agent,
            cwd,
            tokensPerSec
        }),

        // Input prompt
        h(InputPrompt, {
            value,
            onChange,
            onSubmit,
            placeholder,
            isDisabled: isStreaming,
            width
        }),

        // Action hints (only show when space available)
        width > 60 ? h(ActionHint, { hints }) : null
    );
};

export default PremiumInputBar;
export { PremiumInputBar, StatusStrip, InputPrompt, ActionHint };
