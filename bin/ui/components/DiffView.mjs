import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import * as Diff from 'diff';

const h = React.createElement;

const normalizeNewlines = (text) => String(text ?? '').replace(/\r\n/g, '\n');

const applySelectedHunks = (originalText, patch, enabledHunkIds) => {
    const original = normalizeNewlines(originalText);
    const hadTrailingNewline = original.endsWith('\n');
    const originalLines = original.split('\n');
    if (hadTrailingNewline) originalLines.pop();

    const out = [];
    let i = 0; // index into originalLines

    const hunks = Array.isArray(patch?.hunks) ? patch.hunks : [];

    for (let h = 0; h < hunks.length; h++) {
        const hunk = hunks[h];
        const id = `${hunk.oldStart}:${hunk.oldLines}->${hunk.newStart}:${hunk.newLines}`;
        const enabled = enabledHunkIds.has(id);

        const oldStartIdx = Math.max(0, (hunk.oldStart || 1) - 1);
        const oldEndIdx = oldStartIdx + (hunk.oldLines || 0);

        // Add unchanged segment before hunk
        while (i < oldStartIdx && i < originalLines.length) {
            out.push(originalLines[i]);
            i++;
        }

        if (!enabled) {
            // Keep original segment for this hunk range
            while (i < oldEndIdx && i < originalLines.length) {
                out.push(originalLines[i]);
                i++;
            }
            continue;
        }

        // Apply hunk lines
        const lines = Array.isArray(hunk.lines) ? hunk.lines : [];
        for (const line of lines) {
            if (!line) continue;
            const prefix = line[0];
            const content = line.slice(1);

            if (prefix === ' ') {
                // context line: consume from original and emit original content (safer than trusting patch line)
                if (i < originalLines.length) {
                    out.push(originalLines[i]);
                    i++;
                } else {
                    out.push(content);
                }
            } else if (prefix === '-') {
                // deletion: consume original line, emit nothing
                if (i < originalLines.length) i++;
            } else if (prefix === '+') {
                // addition: emit new content
                out.push(content);
            } else if (prefix === '\\') {
                // "\ No newline at end of file" marker: ignore
            } else {
                // Unknown prefix: best-effort emit
                out.push(line);
            }
        }

        // After applying enabled hunk, ensure we've consumed the expected old range
        i = Math.max(i, oldEndIdx);
    }

    // Append remaining original
    while (i < originalLines.length) {
        out.push(originalLines[i]);
        i++;
    }

    const joined = out.join('\n') + (hadTrailingNewline ? '\n' : '');
    return joined;
};

const DiffView = ({
    original = '',
    modified = '',
    file = 'unknown.js',
    onApply,
    onApplyAndOpen,
    onApplyAndTest,
    onSkip,
    width = 80,
    height = 20
}) => {
    const normalizedOriginal = normalizeNewlines(original);
    const normalizedModified = normalizeNewlines(modified);

    const patch = Diff.structuredPatch(file, file, normalizedOriginal, normalizedModified, '', '', { context: 3 });
    const hunks = Array.isArray(patch?.hunks) ? patch.hunks : [];
    const hunkIds = hunks.map(h => `${h.oldStart}:${h.oldLines}->${h.newStart}:${h.newLines}`);

    const [enabledHunks, setEnabledHunks] = useState(() => new Set(hunkIds));
    const [mode, setMode] = useState('diff'); // 'diff' | 'hunks'
    const [activeHunkIndex, setActiveHunkIndex] = useState(0);

    // Scroll state
    const [scrollTop, setScrollTop] = useState(0);

    // Calculate total lines for scrolling
    const diffForRender = Diff.diffLines(normalizedOriginal, normalizedModified);
    const totalLines = diffForRender.reduce((acc, part) => acc + part.value.split('\n').length - 1, 0);
    const visibleLines = height - 4; // Header + Footer space

    useInput((input, key) => {
        const maxScroll = Math.max(0, totalLines - visibleLines);

        if (key.tab) {
            setMode(m => (m === 'diff' ? 'hunks' : 'diff'));
            return;
        }

        if (mode === 'hunks') {
            if (key.upArrow) setActiveHunkIndex(v => Math.max(0, v - 1));
            if (key.downArrow) setActiveHunkIndex(v => Math.min(Math.max(0, hunks.length - 1), v + 1));
            if (input.toLowerCase() === 't') {
                const id = hunkIds[activeHunkIndex];
                if (!id) return;
                setEnabledHunks(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                });
            }
            if (input.toLowerCase() === 'a') {
                setEnabledHunks(new Set(hunkIds));
            }
            if (input.toLowerCase() === 'x') {
                setEnabledHunks(new Set());
            }
            if (key.escape) onSkip?.();
            if (key.return) {
                const nextContent = applySelectedHunks(normalizedOriginal, patch, enabledHunks);
                onApply?.(nextContent);
            }
            return;
        }

        // diff scroll mode
        if (key.upArrow) setScrollTop(prev => Math.max(0, prev - 1));
        if (key.downArrow) setScrollTop(prev => Math.min(maxScroll, prev + 1));
        if (key.pageUp) setScrollTop(prev => Math.max(0, prev - visibleLines));
        if (key.pageDown) setScrollTop(prev => Math.min(maxScroll, prev + visibleLines));

        const nextContent = applySelectedHunks(normalizedOriginal, patch, enabledHunks);

        if (input === 'y' || input === 'Y' || key.return) onApply?.(nextContent);
        if (input === 'r' || input === 'R') onApplyAndOpen?.(nextContent);
        if (input === 'v' || input === 'V') onApplyAndTest?.(nextContent);
        if (input === 'n' || input === 'N' || key.escape) onSkip?.();
    });

    // Render Logic
    let currentLine = 0;
    const renderedLines = [];

    diffForRender.forEach((part) => {
        const lines = part.value.split('\n');
        // last element of split is often empty if value ends with newline
        if (lines[lines.length - 1] === '') lines.pop();

        lines.forEach((line) => {
            currentLine++;
            // Check visibility
            if (currentLine <= scrollTop || currentLine > scrollTop + visibleLines) {
                return;
            }

            let color = 'gray'; // Unchanged
            let prefix = '  ';
            let bg = undefined;

            if (part.added) {
                color = 'green';
                prefix = '+ ';
            } else if (part.removed) {
                color = 'red';
                prefix = '- ';
            }

            renderedLines.push(
                h(Box, { key: currentLine, width: '100%' },
                    h(Text, { color: 'gray', dimColor: true }, `${currentLine.toString().padEnd(4)} `),
                    h(Text, { color: color, backgroundColor: bg, wrap: 'truncate-end' }, prefix + line)
                )
            );
        });
    });

    return h(Box, {
        flexDirection: 'column',
        width: width,
        height: height,
        borderStyle: 'double',
        borderColor: 'yellow'
    },
        // Header
        h(Box, { flexDirection: 'column', paddingX: 1, borderStyle: 'single', borderBottom: true, borderTop: false, borderLeft: false, borderRight: false },
            h(Text, { bold: true, color: 'yellow' }, `Reviewing: ${file}`),
            h(Box, { justifyContent: 'space-between' },
                h(Text, { dimColor: true }, `Hunks: ${hunks.length} | Selected: ${enabledHunks.size} | Lines: ${totalLines}`),
                h(Text, { color: 'blue' }, mode === 'hunks' ? 'TAB diff | T toggle | A all | X none' : 'UP/DOWN scroll | TAB hunks | R reopen | V test')
            )
        ),

        mode === 'hunks'
            ? h(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 1, paddingTop: 1 },
                hunks.length === 0
                    ? h(Text, { color: 'gray' }, 'No hunks (files are identical).')
                    : hunks.slice(0, Math.max(1, height - 6)).map((hunk, idx) => {
                        const id = hunkIds[idx];
                        const enabled = enabledHunks.has(id);
                        const isActive = idx === activeHunkIndex;
                        const label = `${enabled ? '[x]' : '[ ]'} @@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
                        return h(Text, {
                            key: id,
                            color: isActive ? 'cyan' : (enabled ? 'green' : 'gray'),
                            backgroundColor: isActive ? 'black' : undefined,
                            bold: isActive,
                            wrap: 'truncate-end'
                        }, label);
                    })
            )
            :
        // Diff Content
        h(Box, { flexDirection: 'column', flexGrow: 1, paddingX: 1 },
            renderedLines.length > 0
                ? renderedLines
                : h(Text, { color: 'gray' }, 'No changes detected (Files are identical)')
        ),

        // Footer Actions
        h(Box, {
            borderStyle: 'single',
            borderTop: true,
            borderBottom: false,
            borderLeft: false,
            borderRight: false,
            paddingX: 1,
            justifyContent: 'center',
            gap: 4
        },
            h(Text, { color: 'green', bold: true }, '[Y/Enter] Apply Selected'),
            h(Text, { color: 'cyan', bold: true }, '[R] Apply + Reopen'),
            h(Text, { color: 'magenta', bold: true }, '[V] Apply + Run Tests'),
            h(Text, { color: 'red', bold: true }, '[N/Esc] Skip')
        )
    );
};

export default DiffView;
