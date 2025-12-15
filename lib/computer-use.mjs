/**
 * Computer Use Integration Module
 * Unified interface for all computer automation capabilities
 * 
 * Integrates:
 * - Playwright browser automation (browser-use inspired)
 * - PowerShell desktop automation (Windows-Use inspired)  
 * - Vision loop for autonomous control (Open-Interface inspired)
 * - Course correction for reliability
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths to executables
const PLAYWRIGHT_BRIDGE = path.join(__dirname, '..', 'bin', 'playwright-bridge.js');
const INPUT_PS1 = path.join(__dirname, '..', 'bin', 'input.ps1');

/**
 * Execute a Playwright command
 */
export async function playwrightCommand(command, ...args) {
    return new Promise((resolve, reject) => {
        const nodeArgs = [PLAYWRIGHT_BRIDGE, command, ...args];
        console.log(`[Playwright] ${command} ${args.join(' ')}`);

        const proc = spawn('node', nodeArgs, {
            cwd: path.dirname(PLAYWRIGHT_BRIDGE),
            shell: true
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, output: stdout.trim() });
            } else {
                resolve({ success: false, output: stdout.trim(), error: stderr.trim() });
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });

        // Timeout after 30 seconds
        setTimeout(() => {
            proc.kill();
            reject(new Error('Command timeout'));
        }, 30000);
    });
}

/**
 * Execute a PowerShell command via input.ps1
 */
export async function powershellCommand(command, ...args) {
    return new Promise((resolve, reject) => {
        const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', INPUT_PS1, command, ...args];
        console.log(`[PowerShell] ${command} ${args.join(' ')}`);

        const proc = spawn('powershell', psArgs, {
            cwd: path.dirname(INPUT_PS1),
            shell: true
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, output: stdout.trim() });
            } else {
                resolve({ success: false, output: stdout.trim(), error: stderr.trim() });
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });

        // Timeout after 30 seconds
        setTimeout(() => {
            proc.kill();
            reject(new Error('Command timeout'));
        }, 30000);
    });
}

/**
 * Intelligent command router
 * Automatically routes to Playwright or PowerShell based on command type
 */
export async function executeCommand(commandString) {
    const trimmed = commandString.trim();

    // Parse the command string
    if (trimmed.startsWith('node') && trimmed.includes('playwright-bridge')) {
        // Extract Playwright command
        const match = trimmed.match(/playwright-bridge\.js\s+(\w+)\s*(.*)/);
        if (match) {
            const cmd = match[1];
            const argsStr = match[2] || '';
            const args = argsStr.match(/"[^"]+"|'[^']+'|\S+/g) || [];
            const cleanArgs = args.map(a => a.replace(/^["']|["']$/g, ''));
            return await playwrightCommand(cmd, ...cleanArgs);
        }
    } else if (trimmed.startsWith('powershell') && trimmed.includes('input.ps1')) {
        // Extract PowerShell command  
        const match = trimmed.match(/input\.ps1\s+(\w+)\s*(.*)/);
        if (match) {
            const cmd = match[1];
            const argsStr = match[2] || '';
            const args = argsStr.match(/"[^"]+"|'[^']+'|\S+/g) || [];
            const cleanArgs = args.map(a => a.replace(/^["']|["']$/g, ''));
            return await powershellCommand(cmd, ...cleanArgs);
        }
    }

    // Try to infer command type
    const browserKeywords = ['navigate', 'fill', 'click', 'press', 'content', 'elements', 'screenshot'];
    const desktopKeywords = ['open', 'uiclick', 'type', 'key', 'mouse', 'apps', 'focus', 'waitfor', 'app_state'];

    const words = trimmed.toLowerCase().split(/\s+/);
    const firstWord = words[0];

    if (browserKeywords.includes(firstWord)) {
        return await playwrightCommand(firstWord, ...words.slice(1));
    } else if (desktopKeywords.includes(firstWord)) {
        return await powershellCommand(firstWord, ...words.slice(1));
    }

    return { success: false, error: 'Unknown command format' };
}

/**
 * Execute multiple commands in sequence with verification
 */
export async function executeSequence(commands, options = {}) {
    const {
        onCommand = () => { },
        onResult = () => { },
        stopOnError = true,
        delayBetween = 500
    } = options;

    const results = [];

    for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        onCommand(i, command);

        try {
            const result = await executeCommand(command);
            results.push({ command, ...result });
            onResult(i, result);

            if (!result.success && stopOnError) {
                break;
            }

            // Wait between commands
            if (i < commands.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delayBetween));
            }
        } catch (error) {
            results.push({ command, success: false, error: error.message });
            if (stopOnError) break;
        }
    }

    return results;
}

/**
 * Browser automation shortcuts
 */
export const browser = {
    navigate: (url) => playwrightCommand('navigate', url),
    click: (selector) => playwrightCommand('click', selector),
    fill: (selector, text) => playwrightCommand('fill', selector, text),
    type: (text) => playwrightCommand('type', text),
    press: (key) => playwrightCommand('press', key),
    content: () => playwrightCommand('content'),
    elements: () => playwrightCommand('elements'),
    screenshot: (file) => playwrightCommand('screenshot', file || 'screenshot.png'),
    close: () => playwrightCommand('close')
};

/**
 * Desktop automation shortcuts
 */
export const desktop = {
    open: (app) => powershellCommand('open', app),
    click: () => powershellCommand('click'),
    rightClick: () => powershellCommand('rightclick'),
    doubleClick: () => powershellCommand('doubleclick'),
    type: (text) => powershellCommand('type', text),
    key: (keyName) => powershellCommand('key', keyName),
    hotkey: (...keys) => powershellCommand('hotkey', keys.join('+')),
    mouse: (x, y) => powershellCommand('mouse', x, y),
    scroll: (amount) => powershellCommand('scroll', amount),
    uiClick: (element) => powershellCommand('uiclick', element),
    find: (element) => powershellCommand('find', element),
    apps: () => powershellCommand('apps'),
    focus: (window) => powershellCommand('focus', window),
    waitfor: (element, timeout) => powershellCommand('waitfor', element, timeout),
    appState: (window) => powershellCommand('app_state', window),
    screenshot: (file) => powershellCommand('screenshot', file || 'screenshot.png'),
    ocr: (region) => powershellCommand('ocr', region)
};

export default {
    playwrightCommand,
    powershellCommand,
    executeCommand,
    executeSequence,
    browser,
    desktop,
    paths: {
        playwrightBridge: PLAYWRIGHT_BRIDGE,
        inputPs1: INPUT_PS1
    }
};
