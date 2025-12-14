const fs = require('fs');
let c = fs.readFileSync('bin/opencode-ink.mjs', 'utf8');

// 1. Add /auto command handler before /theme
const autoCmd = `                case '/auto':
                    setAutoApprove(prev => !prev);
                    setMessages(prev => [...prev, { 
                        role: 'system', 
                        content: !autoApprove ? '▶️ Auto-Approve **ENABLED** - Commands execute automatically in SOLO mode' : '⏸ Auto-Approve **DISABLED** - Commands require confirmation' 
                    }]);
                    setInput('');
                    return;
`;

// Only add if not already present
if (!c.includes("case '/auto':")) {
    c = c.replace(/(case '\/theme':)/g, autoCmd + '                $1');
    console.log('Added /auto command handler');
}

// 2. Add useEffect to auto-execute commands when autoApprove is true
const autoExecEffect = `
    // AUTO-APPROVE: Automatically execute commands in SOLO mode
    useEffect(() => {
        if (autoApprove && soloMode && detectedCommands.length > 0 && !isExecutingCommands) {
            handleExecuteCommands(true);
        }
    }, [autoApprove, soloMode, detectedCommands, isExecutingCommands]);
`;

// Insert after soloMode state declaration
if (!c.includes('AUTO-APPROVE: Automatically execute')) {
    c = c.replace(/(const \[autoApprove, setAutoApprove\] = useState\(false\);[^\n]*\n)/g, '$1' + autoExecEffect);
    console.log('Added auto-execute useEffect');
}

fs.writeFileSync('bin/opencode-ink.mjs', c);
console.log('Done!');
