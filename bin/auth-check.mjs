#!/usr/bin/env node
/**
 * OpenQode Auth Check
 * Verifies Qwen authentication and triggers OAuth if needed.
 * Called by launchers before showing menu.
 * 
 * Exit codes:
 * 0 = Authenticated
 * 1 = Auth failed
 * 2 = User cancelled
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

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

// Token file paths to check
const TOKEN_PATHS = [
    path.join(ROOT, 'tokens.json'),
    path.join(ROOT, '.qwen-tokens.json'),
    path.join(process.env.HOME || process.env.USERPROFILE || '', '.qwen', 'config.json')
];

// Check if we have valid tokens
const checkExistingAuth = () => {
    for (const tokenPath of TOKEN_PATHS) {
        try {
            if (fs.existsSync(tokenPath)) {
                const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                if (data.access_token) {
                    // Check if expired (if expiry info available)
                    if (data.expires_at) {
                        const expiry = new Date(data.expires_at);
                        if (expiry > new Date()) {
                            return { valid: true, source: tokenPath };
                        }
                    } else {
                        // No expiry info, assume valid
                        return { valid: true, source: tokenPath };
                    }
                }
            }
        } catch (e) { /* ignore */ }
    }
    return { valid: false };
};

// Open URL in default browser
const openBrowser = (url) => {
    const platform = process.platform;
    let cmd;

    switch (platform) {
        case 'darwin':
            cmd = `open "${url}"`;
            break;
        case 'win32':
            cmd = `start "" "${url}"`;
            break;
        default:
            cmd = `xdg-open "${url}"`;
    }

    exec(cmd, (err) => {
        if (err) console.log(C.yellow + '  (Could not open browser automatically)' + C.reset);
    });
};

// Perform OAuth device flow
const performAuth = async () => {
    console.log(C.cyan + '\n  Starting Qwen OAuth...' + C.reset);

    try {
        const { QwenOAuth } = await import('../qwen-oauth.mjs');
        const oauth = new QwenOAuth();

        // Start device flow
        const deviceInfo = await oauth.startDeviceFlow();

        console.log('');
        console.log(C.magenta + '  ╔═══════════════════════════════════════════╗' + C.reset);
        console.log(C.magenta + '  ║          QWEN AUTHENTICATION              ║' + C.reset);
        console.log(C.magenta + '  ╚═══════════════════════════════════════════╝' + C.reset);
        console.log('');
        console.log(C.yellow + '  1. Open this URL in your browser:' + C.reset);
        console.log(C.cyan + `     ${deviceInfo.verificationUriComplete || deviceInfo.verificationUri}` + C.reset);
        console.log('');
        if (deviceInfo.userCode) {
            console.log(C.yellow + '  2. Enter this code if prompted:' + C.reset);
            console.log(C.green + C.bold + `     ${deviceInfo.userCode}` + C.reset);
            console.log('');
        }
        console.log(C.dim + '  Waiting for you to complete login in browser...' + C.reset);

        // Try to open browser automatically
        openBrowser(deviceInfo.verificationUriComplete || deviceInfo.verificationUri);

        // Poll for tokens
        const tokens = await oauth.pollForTokens();

        if (tokens && tokens.access_token) {
            // Save tokens
            oauth.saveTokens(tokens);

            // Also save to main tokens.json for compatibility
            const mainTokenPath = path.join(ROOT, 'tokens.json');
            fs.writeFileSync(mainTokenPath, JSON.stringify({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: tokens.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }, null, 2));

            console.log(C.green + '\n  ✅ Authentication successful!' + C.reset);
            return true;
        } else {
            console.log(C.red + '\n  ✗ Authentication failed or timed out.' + C.reset);
            return false;
        }
    } catch (e) {
        console.log(C.red + `\n  ✗ OAuth error: ${e.message}` + C.reset);

        // Provide helpful guidance based on error
        if (e.message.includes('Client ID')) {
            console.log(C.yellow + '\n  To fix this:' + C.reset);
            console.log(C.dim + '  1. Copy config.example.cjs to config.cjs' + C.reset);
            console.log(C.dim + '  2. Add your QWEN_OAUTH_CLIENT_ID' + C.reset);
        }

        return false;
    }
};

// Main
const main = async () => {
    console.log('');
    console.log(C.cyan + '  ╔═══════════════════════════════════════════╗' + C.reset);
    console.log(C.cyan + '  ║        OpenQode Authentication Check      ║' + C.reset);
    console.log(C.cyan + '  ╚═══════════════════════════════════════════╝' + C.reset);
    console.log('');
    console.log(C.dim + '  Checking Qwen authentication status...' + C.reset);

    // Check existing auth
    const authStatus = checkExistingAuth();

    if (authStatus.valid) {
        console.log(C.green + '\n  ✅ Already authenticated!' + C.reset);
        console.log(C.dim + `     Token source: ${path.basename(authStatus.source)}` + C.reset);
        process.exit(0);
    }

    console.log(C.yellow + '\n  [!] Not authenticated. Starting OAuth...' + C.reset);

    const success = await performAuth();

    if (success) {
        console.log(C.green + '\n  Ready to use OpenQode!' + C.reset);
        process.exit(0);
    } else {
        console.log(C.yellow + '\n  You can still use OpenQode, but AI features may be limited.' + C.reset);
        process.exit(1);
    }
};

main().catch(e => {
    console.error(C.red + `Auth check failed: ${e.message}` + C.reset);
    process.exit(1);
});
