/**
 * Clean TODO Checklist Component
 * 
 * Based on sst/opencode todowrite rendering
 * Credit: https://github.com/sst/opencode
 * 
 * Clean [ ]/[x] checklist with status highlighting
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../tui-theme.mjs';
import { getCapabilities } from '../../terminal-profile.mjs';

const h = React.createElement;

// TODO status types
export const TODO_STATUS = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    DONE: 'done'
};

/**
 * Single TODO item
 */
const TodoItem = ({ text, status = TODO_STATUS.PENDING, width = 80 }) => {
    const caps = getCapabilities();

    // Checkbox
    const checkbox = status === TODO_STATUS.DONE
        ? '[x]'
        : status === TODO_STATUS.IN_PROGRESS
            ? '[/]'
            : '[ ]';

    // Status-based styling
    const textColor = status === TODO_STATUS.DONE
        ? colors.muted
        : status === TODO_STATUS.IN_PROGRESS
            ? colors.success
            : colors.fg;

    const isDim = status === TODO_STATUS.DONE;

    // Truncate text if needed
    const maxTextWidth = width - 5;
    const displayText = text.length > maxTextWidth
        ? text.slice(0, maxTextWidth - 1) + '…'
        : text;

    return h(Box, { flexDirection: 'row' },
        h(Text, {
            color: status === TODO_STATUS.IN_PROGRESS ? colors.success : colors.muted
        }, checkbox + ' '),
        h(Text, {
            color: textColor,
            dimColor: isDim,
            strikethrough: status === TODO_STATUS.DONE
        }, displayText)
    );
};

/**
 * Clean TODO List - OpenCode style
 * 
 * Props:
 * - items: array of { text, status }
 * - isExpanded: show full list or summary
 * - width: available width
 */
const CleanTodoList = ({
    items = [],
    isExpanded = false,
    title = 'Tasks',
    width = 80
}) => {
    const caps = getCapabilities();

    // Count stats
    const total = items.length;
    const done = items.filter(i => i.status === TODO_STATUS.DONE).length;
    const inProgress = items.filter(i => i.status === TODO_STATUS.IN_PROGRESS).length;

    // Summary line
    const summaryText = `${done}/${total} done`;
    const progressIcon = caps.unicodeOK ? '▰' : '#';
    const emptyIcon = caps.unicodeOK ? '▱' : '-';

    // Progress bar (visual)
    const progressWidth = Math.min(10, width - 20);
    const filledCount = total > 0 ? Math.round((done / total) * progressWidth) : 0;
    const progressBar = progressIcon.repeat(filledCount) + emptyIcon.repeat(progressWidth - filledCount);

    // Collapsed view: just summary
    if (!isExpanded && total > 3) {
        return h(Box, { flexDirection: 'column' },
            h(Box, { flexDirection: 'row' },
                h(Text, { color: colors.muted, bold: true }, title + ': '),
                h(Text, { color: colors.accent }, progressBar),
                h(Text, { color: colors.muted }, ` ${summaryText}`)
            ),
            // Show in-progress items even when collapsed
            ...items
                .filter(i => i.status === TODO_STATUS.IN_PROGRESS)
                .slice(0, 2)
                .map((item, i) => h(TodoItem, {
                    key: i,
                    text: item.text,
                    status: item.status,
                    width
                }))
        );
    }

    // Expanded view: full list
    return h(Box, { flexDirection: 'column' },
        // Header
        h(Box, { flexDirection: 'row', marginBottom: 0 },
            h(Text, { color: colors.muted, bold: true }, title + ' '),
            h(Text, { color: colors.accent }, progressBar),
            h(Text, { color: colors.muted }, ` ${summaryText}`)
        ),

        // Items
        ...items.map((item, i) => h(TodoItem, {
            key: i,
            text: item.text,
            status: item.status,
            width
        }))
    );
};

/**
 * Convert legacy todo format to clean format
 */
function normalizeTodos(todos) {
    if (!Array.isArray(todos)) return [];

    return todos.map(todo => {
        // Handle string items
        if (typeof todo === 'string') {
            return { text: todo, status: TODO_STATUS.PENDING };
        }

        // Handle object items
        return {
            text: todo.text || todo.content || todo.title || String(todo),
            status: todo.status || (todo.done ? TODO_STATUS.DONE : TODO_STATUS.PENDING)
        };
    });
}

export default CleanTodoList;
export { CleanTodoList, TodoItem, normalizeTodos };
