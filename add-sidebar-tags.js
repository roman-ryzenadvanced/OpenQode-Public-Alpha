const fs = require('fs');
let c = fs.readFileSync('bin/opencode-ink.mjs', 'utf8');

// Add SOLO and Auto-Approve indicators after the "Think" row in sidebar
const soloIndicators = `                 h(Box, {},
                     h(Text, { color: 'gray' }, 'SOLO:   '),
                     soloMode
                         ? h(Text, { color: 'magenta', bold: true }, 'ON')
                         : h(Text, { color: 'gray', dimColor: true }, 'OFF')
                 ),
                 h(Box, {},
                     h(Text, { color: 'gray' }, 'AutoRun:'),
                     autoApprove
                         ? h(Text, { color: 'yellow', bold: true }, 'ON')
                         : h(Text, { color: 'gray', dimColor: true }, 'OFF')
                 ),`;

// Insert after the Think row (before the empty h(Text, {}, '') line)
if (!c.includes("h(Text, { color: 'gray' }, 'SOLO:   ')")) {
    c = c.replace(
        /(h\(Box, \{\},\s*\n\s*h\(Text, \{ color: 'gray' \}, 'Think:  '\),\s*\n\s*exposedThinking\s*\n\s*\? h\(Text, \{ color: 'green', bold: true \}, 'ON'\)\s*\n\s*: h\(Text, \{ color: 'gray', dimColor: true \}, 'OFF'\)\s*\n\s*\),)/g,
        '$1\n' + soloIndicators
    );
    console.log('Added SOLO and Auto-Approve indicators to sidebar');
} else {
    console.log('Indicators already present');
}

fs.writeFileSync('bin/opencode-ink.mjs', c);
console.log('Done!');
