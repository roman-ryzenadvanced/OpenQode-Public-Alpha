#!/usr/bin/env node

/**
 * OpenQode Qwen Authentication - 3-Tier Cascading Fallback
 * 1. Try official qwen CLI (if installed)
 * 2. Try OAuth device flow (if client ID configured)
 * 3. Provide manual authentication instructions
 */

const { QwenOAuth } = require('../qwen-oauth.cjs');
const { spawn, exec } = require('child_process');
const readline = require('readline');
const os = require('os');
const fs = require('fs');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function openBrowser(url) {
    const platform = os.platform();
    let command;

    if (platform === 'win32') {
        command = `start "${url}"`;
    } else if (platform === 'darwin') {
        command = `open "${url}"`;
    } else {
        command = `xdg-open "${url}"`;
    }

    exec(command, (error) => {
        if (error) {
            console.log('  (Please open the URL manually if it didn\'t open)');
        }
    });
}

function checkQwenCLI() {
    return new Promise((resolve) => {
        const path = require('path');
        const fs = require('fs');

        // Check local installation first (bundled with OpenQode)
        const localCLI = path.join(__dirname, '..', 'node_modules', '.bin', 'qwen');
        const localCLICmd = path.join(__dirname, '..', 'node_modules', '.bin', 'qwen.cmd');

        if (fs.existsSync(localCLI) || fs.existsSync(localCLICmd)) {
            resolve({ found: true, isLocal: true });
            return;
        }

        // Fall back to global installation
        exec('qwen --version', (error, stdout) => {
            resolve({ found: !error && stdout.includes('qwen'), isLocal: false });
        });
    });
}

async function tryOfficialCLI() {
    console.log('\n🔍 Checking for official Qwen CLI...');

    const cliCheck = await checkQwenCLI();
    if (!cliCheck.found) {
        console.log('   ❌ Official Qwen CLI not found');
        return false;
    }

    if (cliCheck.isLocal) {
        console.log('   ✅ Bundled Qwen CLI detected!');
        console.log('   📦 Using local installation from node_modules');
    } else {
        console.log('   ✅ Global Qwen CLI detected!');
    }

    console.log('\n📱 Launching Qwen CLI authentication...\n');

    return new Promise((resolve) => {
        const path = require('path');
        const os = require('os');
        const isWin = os.platform() === 'win32';  // Define at function scope
        let command, args;

        if (cliCheck.isLocal) {
            // Use local bundled CLI
            const localCLIPath = path.join(__dirname, '..', 'node_modules', '.bin', isWin ? 'qwen.cmd' : 'qwen');

            if (isWin) {
                // On Windows: Wrap .cmd path in quotes to handle spaces
                command = `"${localCLIPath}"`;
                args = [];
            } else {
                // On Unix, call node with the script
                command = 'node';
                args = [localCLIPath];
            }
        } else {
            // Use global CLI
            command = 'qwen';
            args = [];
        }

        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: isWin  // Must use shell on Windows for .cmd files
        });

        child.on('error', (err) => {
            console.log(`\n   ❌ CLI auth failed: ${err.message}`);
            resolve(false);
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log('\n   ✅ CLI authentication successful!');
                resolve(true);
            } else {
                console.log('\n   ❌ CLI authentication failed or was cancelled');
                resolve(false);
            }
        });
    });
}

async function tryOAuthFlow() {
    console.log('\n🔐 Attempting OAuth device flow...');

    const oauth = new QwenOAuth();

    try {
        const flow = await oauth.startDeviceFlow();

        console.log(`\n  📋 Your User Code: \x1b[1;33m${flow.userCode}\x1b[0m`);
        console.log(`  🔗 Verification URL: \x1b[1;36m${flow.verificationUri}\x1b[0m\n`);
        console.log('  🌐 Opening browser...');

        openBrowser(flow.verificationUriComplete || flow.verificationUri);

        console.log('\n  ⏳ Waiting for you to complete login in the browser...');

        const tokens = await oauth.pollForTokens();

        console.log('\n\x1b[1;32m  ✅ OAuth authentication successful!\x1b[0m');
        console.log('  💾 Tokens saved and shared with all tools\n');
        return true;

    } catch (error) {
        if (error.message.includes('Missing Client ID') || error.message.includes('invalid_client_credentials')) {
            console.log('   ❌ OAuth client ID not configured');
        } else {
            console.log(`   ❌ OAuth failed: ${error.message}`);
        }
        return false;
    }
}

function showManualInstructions() {
    console.log('\n' + '='.repeat(60));
    console.log('\x1b[1;33m  📋 MANUAL AUTHENTICATION REQUIRED\x1b[0m');
    console.log('='.repeat(60) + '\n');
    console.log('  All automated methods failed. Please choose one option:\n');
    console.log('  \x1b[1;36mOption 1: Install Official Qwen CLI\x1b[0m (Recommended)');
    console.log('  Run: \x1b[32mnpm install -g @qwen-code/qwen-code\x1b[0m');
    console.log('  Then: \x1b[32mqwen\x1b[0m (it will authenticate automatically)\n');
    console.log('  \x1b[1;36mOption 2: Configure OAuth Client ID\x1b[0m');
    console.log('  1. Get a client ID from Qwen (contact support or check docs)');
    console.log('  2. Copy config.example.cjs to config.cjs');
    console.log('  3. Add your QWEN_OAUTH_CLIENT_ID to config.cjs\n');
    console.log('  \x1b[1;36mOption 3: Manual Session\x1b[0m');
    console.log('  Visit: \x1b[36mhttps://qwen.ai\x1b[0m and sign in');
    console.log('  Note: Web sessions won\'t give API tokens for OpenQode\n');
    console.log('='.repeat(60) + '\n');
}

// Main authentication flow
(async () => {
    console.log('\n========================================================');
    console.log('  🚀 OpenQode Qwen Authentication');
    console.log('========================================================\n');
    console.log('  Trying 3-tier cascading authentication...\n');

    // Tier 1: Official Qwen CLI
    console.log('┌─ Tier 1: Official Qwen CLI');
    const cliSuccess = await tryOfficialCLI();
    if (cliSuccess) {
        rl.close();
        return;
    }

    // Tier 2: OAuth Device Flow
    console.log('\n├─ Tier 2: OAuth Device Flow');
    const oauthSuccess = await tryOAuthFlow();
    if (oauthSuccess) {
        rl.close();
        return;
    }

    // Tier 3: Manual Instructions
    console.log('\n└─ Tier 3: Manual Instructions');
    showManualInstructions();

    rl.close();
})();
