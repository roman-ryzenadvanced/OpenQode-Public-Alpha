/**
 * Preview Plan Component - Noob-proof action preview
 * 
 * CORE NOOB-PROOF FEATURE:
 * Before running actions, show a numbered list with:
 * - Risk labels (Safe / Needs approval / Manual)
 * - Edit options per step
 * - Default actions: Run / Step-by-step / Edit / Cancel
 * 
 * Credit: OpenCode patterns + Windows-Use verification
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../tui-theme.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

// Risk levels
export const RISK_LEVELS = {
    SAFE: 'safe',
    NEEDS_APPROVAL: 'needs_approval',
    MANUAL: 'manual'
};

const RISK_CONFIG = {
    [RISK_LEVELS.SAFE]: {
        label: 'Safe',
        color: 'green',
        icon: '✓',
        iconAscii: '+'
    },
    [RISK_LEVELS.NEEDS_APPROVAL]: {
        label: 'Approval',
        color: 'yellow',
        icon: '⚠',
        iconAscii: '!'
    },
    [RISK_LEVELS.MANUAL]: {
        label: 'Manual',
        color: 'magenta',
        icon: '👤',
        iconAscii: '*'
    }
};

/**
 * Single step in preview
 */
const PreviewStep = ({
    index,
    description,
    risk = RISK_LEVELS.SAFE,
    isSelected = false,
    width = 60
}) => {
    const caps = getCapabilities();
    const riskConfig = RISK_CONFIG[risk];
    const riskIcon = caps.unicodeOK ? riskConfig.icon : riskConfig.iconAscii;

    // Truncate description
    const maxDescWidth = width - 15;
    const desc = description.length > maxDescWidth
        ? description.slice(0, maxDescWidth - 1) + '…'
        : description;

    return h(Box, { flexDirection: 'row' },
        // Selection indicator
        h(Text, { color: isSelected ? colors.accent : colors.muted },
            isSelected ? '▸ ' : '  '
        ),

        // Step number
        h(Text, { color: colors.muted }, `${index + 1}) `),

        // Description
        h(Text, { color: colors.fg }, desc),

        // Risk label
        h(Text, { color: riskConfig.color, dimColor: risk === RISK_LEVELS.SAFE },
            ` [${riskIcon} ${riskConfig.label}]`
        )
    );
};

/**
 * Action buttons at bottom
 */
const PreviewActions = ({ onRun, onStepByStep, onEdit, onCancel }) => {
    const caps = getCapabilities();
    const separator = caps.unicodeOK ? '│' : '|';

    return h(Box, { flexDirection: 'row', marginTop: 1, gap: 1 },
        h(Text, { color: colors.success, bold: true }, '[Enter] Run'),
        h(Text, { color: colors.muted }, separator),
        h(Text, { color: colors.accent }, '[s] Step-by-step'),
        h(Text, { color: colors.muted }, separator),
        h(Text, { color: 'yellow' }, '[e] Edit'),
        h(Text, { color: colors.muted }, separator),
        h(Text, { color: colors.error }, '[Esc] Cancel')
    );
};

/**
 * Preview Plan Component
 * 
 * Props:
 * - steps: array of { description, risk, target }
 * - title: optional title
 * - selectedIndex: currently selected step (for editing)
 * - onRun: callback when user confirms run
 * - onStepByStep: callback for step-by-step mode
 * - onEdit: callback for edit mode
 * - onCancel: callback for cancel
 * - width: available width
 */
const PreviewPlan = ({
    steps = [],
    title = 'Preview Plan',
    selectedIndex = -1,
    onRun = null,
    onStepByStep = null,
    onEdit = null,
    onCancel = null,
    width = 80
}) => {
    const caps = getCapabilities();

    // Border characters
    const borderH = caps.unicodeOK ? '─' : '-';
    const cornerTL = caps.unicodeOK ? '┌' : '+';
    const cornerTR = caps.unicodeOK ? '┐' : '+';
    const cornerBL = caps.unicodeOK ? '└' : '+';
    const cornerBR = caps.unicodeOK ? '┘' : '+';

    const contentWidth = width - 4;

    // Count risks
    const needsApproval = steps.filter(s => s.risk === RISK_LEVELS.NEEDS_APPROVAL).length;
    const manualSteps = steps.filter(s => s.risk === RISK_LEVELS.MANUAL).length;

    return h(Box, { flexDirection: 'column', marginY: 1 },
        // Header
        h(Text, { color: colors.accent },
            cornerTL + borderH + ` ${title} (${steps.length} steps) ` +
            borderH.repeat(Math.max(0, contentWidth - title.length - 12)) + cornerTR
        ),

        // Steps list
        h(Box, { flexDirection: 'column', paddingX: 1 },
            ...steps.map((step, i) =>
                h(PreviewStep, {
                    key: i,
                    index: i,
                    description: step.description,
                    risk: step.risk || RISK_LEVELS.SAFE,
                    isSelected: i === selectedIndex,
                    width: contentWidth
                })
            )
        ),

        // Risk summary (if any)
        (needsApproval > 0 || manualSteps > 0) ? h(Box, { paddingX: 1, marginTop: 0 },
            needsApproval > 0 ? h(Text, { color: 'yellow', dimColor: true },
                `${needsApproval} step(s) need approval  `
            ) : null,
            manualSteps > 0 ? h(Text, { color: 'magenta', dimColor: true },
                `${manualSteps} manual step(s)`
            ) : null
        ) : null,

        // Action buttons
        h(Box, { paddingX: 1 },
            h(PreviewActions, { onRun, onStepByStep, onEdit, onCancel })
        ),

        // Bottom border
        h(Text, { color: colors.accent },
            cornerBL + borderH.repeat(contentWidth) + cornerBR
        )
    );
};

export default PreviewPlan;
export { PreviewPlan, PreviewStep };
