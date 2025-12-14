#!/usr/bin/env node
/**
 * OpenQode Auth Check
 * Runs qwen auth if not authenticated. Shows URL for manual auth.
 * Centralized auth for all tools (TUI, Smart Repair, etc.)
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors
const C = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    bold: '\x1b[1m',
    dim: '\x1b[2m'
};

// Get qwen command for current platform
const getQwenCommand = () => {
    const isWin = process.platform === 'win32';
    if (isWin) {
        const appData = process.env.APPDATA || '';
        const cliPath = path.join(appData, 'npm', 'node_modules', '@qwen-code', 'qwen-code', 'cli.js');
        if (fs.existsSync(cliPath)) {
            return { command: 'node', args: [cliPath] };
        }
        return { command: 'qwen.cmd', args: [] };
    }
    return { command: 'qwen', args: [] };
};

// Check if authenticated by running a quick test
const checkAuth = () => {
    return new Promise((resolve) => {
        const { command, args } = getQwenCommand();
        const child = spawn(command, [...args, '--version'], { shell: false, timeout: 5000 });

        child.on('error', () => resolve({ installed: false }));
        child.on('close', (code) => {
            resolve({ installed: code === 0 });
        });

        setTimeout(() => { child.kill(); resolve({ installed: false }); }, 5000);
    });
};

// Run qwen auth and show output (including URLs)
const runQwenAuth = () => {
    return new Promise((resolve) => {
        console.log(C.yellow + '\n  Starting Qwen authentication...' + C.reset);
        console.log(C.dim + '  This will open your browser for login.' + C.reset);
        console.log(C.dim + '  If browser doesn\'t open, copy the URL shown below.' + C.reset);
        console.log('');

        const { command, args } = getQwenCommand();
        const child = spawn(command, [...args, 'auth'], {
            shell: false,
            stdio: 'inherit'  // Show all output directly to user (includes URL)
        });

        child.on('error', (err) => {
            console.log(C.red + `\n  Error: ${err.message}` + C.reset);
            console.log('');
            console.log(C.yellow + '  To install qwen CLI:' + C.reset);
            console.log(C.cyan + '     npm install -g @qwen-code/qwen-code' + C.reset);
            resolve(false);
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(C.green + '\n  ✅ Authentication successful!' + C.reset);
                resolve(true);
            } else {
                console.log(C.yellow + '\n  Authentication may not have completed.' + C.reset);
                console.log(C.dim + '  You can try again later with: qwen auth' + C.reset);
                resolve(false);
            }
        });
    });
};

// Main
const main = async () => {
    console.log('');
    console.log(C.cyan + '  ╔═══════════════════════════════════════════╗' + C.reset);
    console.log(C.cyan + '  ║        OpenQode Authentication Check      ║' + C.reset);
    console.log(C.cyan + '  ╚═══════════════════════════════════════════╝' + C.reset);
    console.log('');
    console.log(C.dim + '  Checking qwen CLI...' + C.reset);

    const result = await checkAuth();

    if (!result.installed) {
        console.log(C.yellow + '\n  ⚠️  qwen CLI not found.' + C.reset);
        console.log('');
        console.log(C.yellow + '  To install:' + C.reset);
        console.log(C.cyan + '     npm install -g @qwen-code/qwen-code' + C.reset);
        console.log('');
        console.log(C.yellow + '  Then authenticate:' + C.reset);
        console.log(C.cyan + '     qwen auth' + C.reset);
        console.log('');
        process.exit(1);
    }

    console.log(C.green + '  ✅ qwen CLI is installed!' + C.reset);

    // Check for existing tokens
    const tokenPaths = [
        path.join(process.env.HOME || process.env.USERPROFILE || '', '.qwen', 'auth.json'),
        path.join(process.env.HOME || process.env.USERPROFILE || '', '.qwen', 'config.json'),
        path.join(__dirname, '..', '.qwen-tokens.json'),
        path.join(__dirname, '..', 'tokens.json'),
    ];

    let hasToken = false;
    for (const tokenPath of tokenPaths) {
        try {
            if (fs.existsSync(tokenPath)) {
                const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                if (data.access_token || data.token || data.api_key) {
                    hasToken = true;
                    console.log(C.green + '  ✅ Found authentication token!' + C.reset);
                    break;
                }
            }
        } catch (e) { /* ignore */ }
    }

    if (!hasToken) {
        console.log(C.yellow + '\n  No authentication token found.' + C.reset);
        console.log(C.dim + '  Running qwen auth to authenticate...' + C.reset);

        const success = await runQwenAuth();
        if (!success) {
            console.log('');
            console.log(C.yellow + '  You can use OpenQode, but AI features require authentication.' + C.reset);
            console.log(C.dim + '  Run "qwen auth" anytime to authenticate.' + C.reset);
        }
    } else {
        console.log(C.dim + '  Ready to use OpenQode!' + C.reset);
    }

    console.log('');
    process.exit(0);
};

main().catch(e => {
    console.error(C.red + `Auth check failed: ${e.message}` + C.reset);
    process.exit(1);
});
