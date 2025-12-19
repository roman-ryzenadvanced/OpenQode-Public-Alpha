/**
 * CodeCard Component (SnippetBlock)
 * 
 * Renders code blocks with a Discord-style header and Google-style friendly paths.
 * Supports syntax highlighting via ink-markdown and smart collapsing.
 */

import React, { useState, useMemo } from 'react';
import { Box, Text } from 'ink';
import Markdown from '../../ink-markdown-esm.mjs';
import path from 'path';

const h = React.createElement;

export const CodeCard = ({ language, filename, content, width, isStreaming, project }) => {
    const lineCount = content ? content.split('\n').length : 0;
    const [isExpanded, setIsExpanded] = useState(false);

    // Calculate safe content width accounting for spacing
    const contentWidth = width ? width - 4 : 60; // Account for left gutter (2) and spacing (2)

    // SMART PATH RESOLUTION
    // Resolve the display path relative to the project root for a "Friendly" view
    const displayPath = useMemo(() => {
        if (!filename || filename === 'snippet.txt') return { dir: '', base: filename || 'snippet' };

        // If we have a project root, try to resolve relative path
        if (project && filename) {
            try {
                // If it's absolute, make it relative to project
                if (path.isAbsolute(filename)) {
                    const rel = path.relative(project, filename);
                    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
                        return { dir: path.dirname(rel), base: path.basename(rel) };
                    }
                }
                // If it's already relative (likely from AI response like 'src/index.js')
                // Check if it has directory limits
                if (filename.includes('/') || filename.includes('\\')) {
                    return { dir: path.dirname(filename), base: path.basename(filename) };
                }
            } catch (e) { /* ignore path errors */ }
        }
        return { dir: '', base: filename };
    }, [filename, project]);

    // Determine if we should show the expand/collapse functionality
    // Smart Streaming Tail: If streaming and very long, collapse middle to show progress
    const STREAMING_MAX_LINES = 20;
    const STATIC_MAX_LINES = 10;

    // Always allow expansion if long enough
    const isLong = lineCount > (isStreaming ? STREAMING_MAX_LINES : STATIC_MAX_LINES);

    const renderContent = () => {
        if (isExpanded || !isLong) {
            return h(Markdown, { syntaxTheme: 'github', width: contentWidth }, `\`\`\`${language || ''}\n${content}\n\`\`\``);
        }

        const lines = content.split('\n');
        // Collapsed Logic
        let firstLines, lastLines, hiddenCount;

        if (isStreaming) {
            // Streaming Mode: Show Head + Active Tail
            // This ensures user sees the code BEING written
            firstLines = lines.slice(0, 5).join('\n');
            lastLines = lines.slice(-10).join('\n'); // Show last 10 lines for context
            hiddenCount = lineCount - 15;
        } else {
            // Static Mode: Show Head + Foot
            firstLines = lines.slice(0, 5).join('\n');
            lastLines = lines.slice(-3).join('\n');
            hiddenCount = lineCount - 8;
        }

        const previewContent = `${firstLines}\n\n// ... (${hiddenCount} lines hidden) ...\n\n${lastLines}`;
        return h(Markdown, { syntaxTheme: 'github', width: contentWidth }, `\`\`\`${language || ''}\n${previewContent}\n\`\`\``);
    };

    return h(Box, {
        flexDirection: 'column',
        width: width,
        marginLeft: 2,
        marginBottom: 1
    },
        // SMART HEADER with Friendly Path
        h(Box, {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 0.5
        },
            h(Box, { flexDirection: 'row' },
                displayPath.dir && displayPath.dir !== '.' ?
                    h(Text, { color: 'gray', dimColor: true }, `📂 ${displayPath.dir} / `) : null,
                h(Text, { color: 'cyan', bold: true }, `📄 ${displayPath.base}`),
                h(Text, { color: 'gray', dimColor: true }, ` (${language})`)
            ),
            h(Text, { color: 'gray', dimColor: true }, `${lineCount} lines`)
        ),

        // Content area - no borders
        h(Box, {
            borderStyle: 'single',
            borderColor: 'gray',
            padding: 1
        },
            renderContent()
        ),

        // Expand/collapse control
        isLong ? h(Box, {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginTop: 0.5
        },
            h(Text, { color: 'cyan', dimColor: true }, isExpanded ? '▼ collapse' : (isStreaming ? '▼ auto-scroll (expand to view all)' : '▶ expand'))
        ) : null
    );
};
