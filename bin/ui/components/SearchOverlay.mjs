import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';

const h = React.createElement;

const SearchOverlay = ({
    isOpen = false,
    initialQuery = '',
    results = [],
    isSearching = false,
    error = null,
    onClose,
    onSearch,
    onOpenResult,
    width = 80,
    height = 24
}) => {
    const [query, setQuery] = useState(initialQuery || '');
    const [mode, setMode] = useState('query'); // 'query' | 'results'

    useEffect(() => {
        if (!isOpen) return;
        setQuery(initialQuery || '');
        setMode('query');
    }, [isOpen, initialQuery]);

    useInput((input, key) => {
        if (!isOpen) return;
        if (key.escape) {
            if (typeof onClose === 'function') onClose();
        }
        if (key.tab) {
            setMode(m => (m === 'query' ? 'results' : 'query'));
        }
        if (key.ctrl && input.toLowerCase() === 'c') {
            if (typeof onClose === 'function') onClose();
        }
    }, { isActive: isOpen });

    const items = useMemo(() => {
        const max = Math.max(0, height - 8);
        return results.slice(0, Math.min(200, max)).map((r, idx) => ({
            label: `${r.rel}:${r.line}${r.text ? `  ${r.text}` : ''}`.slice(0, Math.max(10, width - 6)),
            value: idx
        }));
    }, [results, width, height]);

    if (!isOpen) return null;

    return h(Box, {
        flexDirection: 'column',
        width,
        height,
        borderStyle: 'double',
        borderColor: 'magenta',
        paddingX: 1,
        paddingY: 0
    },
        h(Box, { justifyContent: 'space-between' },
            h(Text, { color: 'magenta', bold: true }, 'Search (ripgrep)'),
            h(Text, { color: 'gray', dimColor: true }, 'Esc close · Enter search/open · Tab switch')
        ),
        h(Box, { marginTop: 1, flexDirection: 'row' },
            h(Text, { color: 'yellow' }, 'Query: '),
            h(Box, { flexGrow: 1 },
                h(TextInput, {
                    value: query,
                    focus: mode === 'query',
                    onChange: setQuery,
                    onSubmit: async () => {
                        if (typeof onSearch === 'function') {
                            setMode('results');
                            await onSearch(query);
                        }
                    },
                    placeholder: 'e.g. function handleSubmit'
                })
            )
        ),
        h(Box, { marginTop: 1 },
            isSearching ? h(Text, { color: 'yellow' }, 'Searching...') : null,
            error ? h(Text, { color: 'red' }, error) : null,
            (!isSearching && !error) ? h(Text, { color: 'gray', dimColor: true }, `${results.length} result(s)`) : null
        ),
        h(Box, { flexDirection: 'column', flexGrow: 1, marginTop: 1 },
            items.length > 0
                ? h(SelectInput, {
                    items,
                    isFocused: mode === 'results',
                    onSelect: (item) => {
                        const r = results[item.value];
                        if (r && typeof onOpenResult === 'function') onOpenResult(r);
                    },
                    itemComponent: ({ isSelected, label }) =>
                        h(Text, { color: isSelected ? 'cyan' : 'white', bold: isSelected, wrap: 'truncate-end' }, label)
                })
                : h(Text, { color: 'gray', dimColor: true }, 'No results yet. Type a query and press Enter.')
        )
    );
};

export default SearchOverlay;

