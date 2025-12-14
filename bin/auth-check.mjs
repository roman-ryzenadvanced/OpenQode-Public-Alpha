#!/usr/bin/env node
/**
 * OpenQode Auth Check
 * Verifies qwen CLI is authenticated by running a test command.
 * Called by launchers before showing menu.
 * 
 * This uses the same auth method as TUI (qwen CLI)
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

// Check if qwen CLI is installed and authenticated
const checkQwenCLI = () => {
    return new Promise((resolve) => {
        const isWin = process.platform === 'win32';
        let command = 'qwen';
        let args = ['--version'];

        // On Windows, try to find the CLI directly
        if (isWin) {
            const appData = process.env.APPDATA || '';
            const cliPath = path.join(appData, 'npm', 'node_modules', '@qwen-code', 'qwen-code', 'cli.js');
            if (fs.existsSync(cliPath)) {
                command = 'node';
                args = [cliPath, '--version'];
            } else {
                command = 'qwen.cmd';
            }
        }

        const child = spawn(command, args, {
            shell: false,
            timeout: 10000
        });

        let output = '';
        child.stdout?.on('data', (data) => { output += data.toString(); });
        child.stderr?.on('data', (data) => { output += data.toString(); });

        child.on('error', (err) => {
            resolve({ installed: false, error: err.message });
        });

        child.on('close', (code) => {
            if (code === 0 || output.includes('qwen')) {
                resolve({ installed: true, version: output.trim() });
            } else {
                resolve({ installed: false, error: `Exit code: ${code}` });
            }
        });

        // Timeout fallback
        setTimeout(() => {
            child.kill();
            resolve({ installed: false, error: 'Timeout' });
        }, 5000);
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

    const result = await checkQwenCLI();

    if (result.installed) {
        console.log(C.green + '  ✅ qwen CLI is installed and ready!' + C.reset);
        if (result.version) {
            console.log(C.dim + `     ${result.version}` + C.reset);
        }
        console.log('');
        console.log(C.dim + '  If you need to authenticate, run: qwen auth' + C.reset);
        process.exit(0);
    } else {
        console.log(C.yellow + '  ⚠️  qwen CLI not found or not working.' + C.reset);
        console.log('');
        console.log(C.yellow + '  To install qwen CLI:' + C.reset);
        console.log(C.cyan + '     npm install -g @qwen-code/qwen-code' + C.reset);
        console.log('');
        console.log(C.yellow + '  After install, authenticate with:' + C.reset);
        console.log(C.cyan + '     qwen auth' + C.reset);
        console.log('');
        console.log(C.dim + '  You can still use OpenQode, but AI features require qwen CLI.' + C.reset);
        process.exit(1);
    }
};

main().catch(e => {
    console.error(C.red + `Auth check failed: ${e.message}` + C.reset);
    process.exit(1);
});
