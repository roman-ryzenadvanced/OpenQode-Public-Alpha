/**
 * Getting Started Card Component
 * 
 * Based on sst/opencode sidebar onboarding pattern
 * Credit: https://github.com/sst/opencode
 * 
 * Dismissible card for new users
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../tui-theme.mjs';
import { icon } from '../../icons.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

/**
 * Getting Started Card - Noob-friendly onboarding
 */
const GettingStartedCard = ({
    isDismissed = false,
    onDismiss = null,
    width = 24
}) => {
    const caps = getCapabilities();
    const [dismissed, setDismissed] = useState(isDismissed);

    if (dismissed) return null;

    const borderH = caps.unicodeOK ? '─' : '-';
    const cornerTL = caps.unicodeOK ? '╭' : '+';
    const cornerTR = caps.unicodeOK ? '╮' : '+';
    const cornerBL = caps.unicodeOK ? '╰' : '+';
    const cornerBR = caps.unicodeOK ? '╯' : '+';
    const railV = caps.unicodeOK ? '│' : '|';
    const sparkle = caps.unicodeOK ? '✨' : '*';

    const contentWidth = Math.max(10, width - 4);

    const handleDismiss = () => {
        setDismissed(true);
        onDismiss?.();
    };

    return h(Box, { flexDirection: 'column', marginY: 1 },
        // Top border with title
        h(Text, { color: colors.accent },
            cornerTL + borderH + ` ${sparkle} Welcome ` + borderH.repeat(Math.max(0, contentWidth - 11)) + cornerTR
        ),

        // Content
        h(Box, { flexDirection: 'column', paddingX: 1 },
            h(Text, { color: colors.fg }, 'Quick Start:'),
            h(Text, { color: colors.muted }, ''),
            h(Text, { color: colors.muted }, `${icon('arrow')} Type a message to chat`),
            h(Text, { color: colors.muted }, `${icon('arrow')} /help for commands`),
            h(Text, { color: colors.muted }, `${icon('arrow')} /settings to configure`),
            h(Text, { color: colors.muted }, ''),
            h(Text, { color: colors.muted }, 'Keyboard:'),
            h(Text, { color: colors.muted }, `  Tab    - Toggle sidebar`),
            h(Text, { color: colors.muted }, `  Ctrl+P - Command palette`),
            h(Text, { color: colors.muted }, `  Ctrl+C - Exit`)
        ),

        // Bottom border with dismiss hint
        h(Text, { color: colors.muted, dimColor: true },
            cornerBL + borderH.repeat(contentWidth - 10) + ` [x] dismiss ` + cornerBR
        )
    );
};

/**
 * CommandHints - Compact keyboard hints
 */
const CommandHints = ({ width = 24 }) => {
    const caps = getCapabilities();

    return h(Box, { flexDirection: 'column' },
        h(Text, { color: colors.muted, bold: true }, 'Commands'),
        h(Text, { color: colors.muted }, '/help    – show help'),
        h(Text, { color: colors.muted }, '/details – toggle details'),
        h(Text, { color: colors.muted }, '/think   – toggle thinking'),
        h(Text, { color: colors.muted }, '/clear   – clear chat'),
        h(Text, { color: colors.muted }, ''),
        h(Text, { color: colors.muted, bold: true }, 'Keys'),
        h(Text, { color: colors.muted }, 'Tab      – sidebar'),
        h(Text, { color: colors.muted }, 'Ctrl+P   – palette'),
        h(Text, { color: colors.muted }, 'Ctrl+C   – exit')
    );
};

export default GettingStartedCard;
export { GettingStartedCard, CommandHints };
