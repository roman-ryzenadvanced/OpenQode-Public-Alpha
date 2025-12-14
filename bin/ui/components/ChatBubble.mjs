import React from 'react';
import { Box, Text } from 'ink';

const h = React.createElement;

const ChatBubble = ({ role, content, meta, width, children }) => {
    // Calculate safe content width accounting for gutter
    const contentWidth = width ? width - 2 : undefined; // Account for left gutter only

    // ═══════════════════════════════════════════════════════════════
    // USER MESSAGE - Clean text-focused presentation
    // ═══════════════════════════════════════════════════════════════
    if (role === 'user') {
        return h(Box, { 
            width: width, 
            flexDirection: 'row', 
            justifyContent: 'flex-end', 
            marginBottom: 1,
            paddingLeft: 2
        },
            h(Text, { color: 'cyan', wrap: 'wrap' }, content)
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // SYSTEM - MINIMALIST TOAST
    // ═══════════════════════════════════════════════════════════════
    if (role === 'system') {
        return h(Box, { width: width, justifyContent: 'center', marginBottom: 1 },
            h(Text, { color: 'gray', dimColor: true }, ` ${content} `)
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ERROR - CLEAN GUTTER STYLE
    // ═══════════════════════════════════════════════════════════════
    if (role === 'error') {
        // Strip redundant "Error: " prefix if present in content
        const cleanContent = content.replace(/^Error:\s*/i, '');
        return h(Box, { 
            width: width, 
            flexDirection: 'row', 
            marginBottom: 1
        },
            h(Box, { width: 1, marginRight: 1, backgroundColor: 'red' }),
            h(Text, { color: 'red', wrap: 'wrap' }, cleanContent)
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // ASSISTANT - Clean text-focused style (Opencode-like)
    // ═══════════════════════════════════════════════════════════════
    return h(Box, { 
        width: width, 
        flexDirection: 'row', 
        marginBottom: 1
    },
        // Clean left gutter similar to opencode
        h(Box, { width: 2, marginRight: 1, borderStyle: 'single', borderRight: false, borderTop: false, borderBottom: false, borderLeftColor: 'green' }),
        
        // Content area - text focused, no borders
        h(Box, { 
            flexDirection: 'column',
            flexGrow: 1, 
            minWidth: 10 
        },
            children ? children : h(Text, { color: 'white', wrap: 'wrap' }, content)
        )
    );
};

export default ChatBubble;
