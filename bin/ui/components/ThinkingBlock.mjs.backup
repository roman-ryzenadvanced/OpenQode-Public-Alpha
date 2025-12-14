import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

const ThinkingBlock = ({
    lines = [],
    isThinking = false,
    stats = { chars: 0 },
    width = 80
}) => {
    // If no thinking lines and not thinking, show nothing
    if (lines.length === 0 && !isThinking) return null;

    // Show only last few lines to avoid clutter
    const visibleLines = lines.slice(-3); // Show cleaner view
    const hiddenCount = Math.max(0, lines.length - 3);

    return h(Box, {
        flexDirection: 'row',
        width: width,
        marginBottom: 1,
        paddingLeft: 1 // Only left padding, no borders like opencode
    },
        // Clean left gutter similar to opencode
        h(Box, { 
            width: 2,
            marginRight: 1, 
            borderStyle: 'single', 
            borderRight: false, 
            borderTop: false, 
            borderBottom: false, 
            borderLeftColor: isThinking ? 'yellow' : 'gray' 
        }),

        h(Box, { flexDirection: 'column', flexGrow: 1 },
            // Header with minimal stats - opencode style
            h(Box, { marginBottom: 0.5, flexDirection: 'row' },
                h(Text, { color: isThinking ? 'yellow' : 'gray', dimColor: !isThinking },
                    isThinking ? '💭 thinking...' : '💭 thinking'
                ),
                stats.activeAgent && h(Text, { color: 'magenta', marginLeft: 1 }, `(${stats.activeAgent})`),
                h(Text, { color: 'gray', marginLeft: 1, dimColor: true }, `(${stats.chars} chars)`)
            ),
            // Thinking lines with cleaner presentation
            visibleLines.map((line, i) =>
                h(Text, { 
                    key: i, 
                    color: 'gray', 
                    dimColor: true, 
                    wrap: 'truncate'
                }, 
                    `  ${line.substring(0, width - 4)}` // Cleaner indentation
                )
            ),
            // Hidden count indicator
            hiddenCount > 0 && h(Text, { 
                color: 'gray', 
                dimColor: true,
                marginLeft: 2
            }, 
                `+${hiddenCount} steps`
            )
        )
    );
};

export default ThinkingBlock;
