import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import path from 'path';

const h = React.createElement;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const renderTabTitle = (tab, maxLen) => {
    const base = tab.title || path.basename(tab.path || '') || 'untitled';
    if (base.length <= maxLen) return base;
    return base.slice(0, Math.max(1, maxLen - 1)) + '…';
};

const FilePreviewTabs = ({
    tabs = [],
    activeId = null,
    onActivate,
    onClose,
    isActive = false,
    width = 80,
    height = 10
}) => {
    const activeTab = tabs.find(t => t.id === activeId) || tabs[0] || null;

    const [scrollTop, setScrollTop] = useState(0);

    useEffect(() => {
        setScrollTop(0);
    }, [activeId]);

    const contentLines = useMemo(() => {
        if (!activeTab?.content) return [];
        return activeTab.content.replace(/\r\n/g, '\n').split('\n');
    }, [activeTab?.content]);

    const headerRows = 2;
    const footerRows = 1;
    const bodyRows = Math.max(3, height - headerRows - footerRows);

    const maxScroll = Math.max(0, contentLines.length - bodyRows);
    const safeScrollTop = clamp(scrollTop, 0, maxScroll);

    useEffect(() => {
        if (safeScrollTop !== scrollTop) setScrollTop(safeScrollTop);
    }, [safeScrollTop, scrollTop]);

    useInput((input, key) => {
        if (!isActive) return;
        if (!activeTab) return;

        if (key.escape) {
            return;
        }

        if (key.upArrow) setScrollTop(v => Math.max(0, v - 1));
        if (key.downArrow) setScrollTop(v => Math.min(maxScroll, v + 1));
        if (key.pageUp) setScrollTop(v => Math.max(0, v - bodyRows));
        if (key.pageDown) setScrollTop(v => Math.min(maxScroll, v + bodyRows));
        if (key.home) setScrollTop(0);
        if (key.end) setScrollTop(maxScroll);

        if (key.leftArrow) {
            const idx = tabs.findIndex(t => t.id === activeTab.id);
            const prev = idx > 0 ? tabs[idx - 1] : tabs[tabs.length - 1];
            if (prev && typeof onActivate === 'function') onActivate(prev.id);
        }
        if (key.rightArrow) {
            const idx = tabs.findIndex(t => t.id === activeTab.id);
            const next = idx >= 0 && idx < tabs.length - 1 ? tabs[idx + 1] : tabs[0];
            if (next && typeof onActivate === 'function') onActivate(next.id);
        }

        if (key.ctrl && input.toLowerCase() === 'w') {
            if (typeof onClose === 'function') onClose(activeTab.id);
        }
    }, { isActive });

    const tabRow = useMemo(() => {
        if (tabs.length === 0) return '';
        const pad = 1;
        const maxTitleLen = Math.max(6, Math.floor(width / Math.max(1, tabs.length)) - 6);
        const parts = tabs.map(t => {
            const title = renderTabTitle(t, maxTitleLen);
            const dirty = t.dirty ? '*' : '';
            return (t.id === activeId ? `[${title}${dirty}]` : ` ${title}${dirty} `);
        });
        const joined = parts.join(' ');
        const truncated = joined.length > width - pad ? joined.slice(0, Math.max(0, width - pad - 1)) + '…' : joined;
        return truncated;
    }, [tabs, activeId, width]);

    const lineNoWidth = Math.max(4, String(safeScrollTop + bodyRows).length + 1);
    const contentWidth = Math.max(10, width - lineNoWidth - 2);

    const visible = contentLines.slice(safeScrollTop, safeScrollTop + bodyRows);

    return h(Box, {
        flexDirection: 'column',
        width,
        height,
        borderStyle: 'single',
        borderColor: isActive ? 'cyan' : 'gray'
    },
        h(Box, { paddingX: 1, justifyContent: 'space-between' },
            h(Text, { color: 'cyan', bold: true }, 'Files'),
            h(Text, { color: 'gray', dimColor: true }, isActive ? '↑↓ scroll  ←→ tabs  Ctrl+W close  Esc focus chat' : 'Ctrl+O open  Ctrl+Shift+F search  Tab focus')
        ),
        h(Box, { paddingX: 1 },
            h(Text, { color: 'white', wrap: 'truncate-end' }, tabRow || '(no tabs)')
        ),
        h(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 1 },
            activeTab ? visible.map((line, i) => {
                const lineNo = safeScrollTop + i + 1;
                const no = String(lineNo).padStart(lineNoWidth - 1) + ' ';
                return h(Box, { key: `${activeTab.id}:${lineNo}`, width: '100%' },
                    h(Text, { color: 'gray', dimColor: true }, no),
                    h(Text, { color: 'white', wrap: 'truncate-end' }, (line || '').slice(0, contentWidth))
                );
            }) : h(Text, { color: 'gray', dimColor: true }, 'Open a file to preview it here.')
        ),
        h(Box, { paddingX: 1, justifyContent: 'space-between' },
            h(Text, { color: 'gray', dimColor: true, wrap: 'truncate' }, activeTab?.relPath ? activeTab.relPath : ''),
            activeTab ? h(Text, { color: 'gray', dimColor: true }, `${safeScrollTop + 1}-${Math.min(contentLines.length, safeScrollTop + bodyRows)} / ${contentLines.length}`) : null
        )
    );
};

export default FilePreviewTabs;

