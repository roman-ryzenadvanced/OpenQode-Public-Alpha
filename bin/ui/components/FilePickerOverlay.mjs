import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { colors } from '../../tui-theme.mjs';

const h = React.createElement;

const FilePickerOverlay = ({
    title = 'Files',
    hint = 'Enter open · Esc close',
    items = [],
    onSelect,
    width = 80,
    height = 24
}) => {
    return h(Box, {
        flexDirection: 'column',
        width,
        height,
        borderStyle: 'double',
        borderColor: 'cyan',
        paddingX: 1,
        paddingY: 0
    },
        h(Box, { justifyContent: 'space-between' },
            h(Text, { color: 'cyan', bold: true }, title),
            h(Text, { color: 'gray', dimColor: true }, hint)
        ),
        h(Box, { flexDirection: 'column', marginTop: 1, flexGrow: 1 },
            items.length > 0
                ? h(SelectInput, {
                    items,
                    onSelect
                })
                : h(Text, { color: colors.muted, dimColor: true }, '(empty)')
        )
    );
};

export default FilePickerOverlay;

