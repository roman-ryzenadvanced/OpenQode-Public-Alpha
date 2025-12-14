#!/usr/bin/env node
/**
 * OpenQode Smart Repair Agent v2.0
 * AI-Powered TUI Self-Healing System
 * 
 * Features:
 * - Qwen AI integration for intelligent error analysis
 * - 3 model choices (Qwen Coder Plus, Qwen Plus, Qwen Turbo)
 * - Offline fallback for common issues
 * - OAuth trigger when auth is missing/expired
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

// File paths relative to package root
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const MAIN_TUI = path.join(ROOT, 'bin', 'opencode-ink.mjs');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const TOKENS_FILE = path.join(ROOT, 'tokens.json');

// API Configuration
const DASHSCOPE_API = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

// Model catalog with 3 Qwen options
const MODELS = {
    '1': {
        id: 'qwen-coder-plus',
        name: 'Qwen Coder Plus',
        description: 'Best for code analysis and bug fixing'
    },
    '2': {
        id: 'qwen-plus',
        name: 'Qwen Plus',
        description: 'General purpose, balanced'
    },
    '3': {
        id: 'qwen-turbo',
        name: 'Qwen Turbo',
        description: 'Fast responses, simpler issues'
    }
};

let selectedModel = MODELS['1']; // Default: Qwen Coder Plus

// Colors for terminal output
const C = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    white: '\x1b[37m'
};

const banner = () => {
    console.clear();
    console.log(C.magenta + C.bold);
    console.log('  ╔═══════════════════════════════════════════╗');
    console.log('  ║   🔧 OpenQode Smart Repair Agent v2.0 🔧   ║');
    console.log('  ║       AI-Powered TUI Self-Healing         ║');
    console.log('  ╚═══════════════════════════════════════════╝');
    console.log(C.reset);
    console.log(C.dim + '  This agent can ONLY repair the TUI. No other tasks.' + C.reset);
    console.log(C.cyan + `  Model: ${selectedModel.name}` + C.reset);
    console.log('');
};

// Get Qwen auth token - checks multiple locations
const getAuthToken = () => {
    // Multiple paths where tokens might be stored
    const tokenPaths = [
        path.join(ROOT, '.qwen-tokens.json'),      // QwenOAuth default
        path.join(ROOT, 'tokens.json'),            // Alternative location
        path.join(process.env.HOME || process.env.USERPROFILE || '', '.qwen', 'config.json'),  // qwen CLI
        path.join(process.env.HOME || process.env.USERPROFILE || '', '.qwen', 'tokens.json'),
    ];

    for (const tokenPath of tokenPaths) {
        try {
            if (fs.existsSync(tokenPath)) {
                const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
                const token = tokens.access_token || tokens.api_key || tokens.token;
                if (token) {
                    console.log(C.dim + `  [Found token in ${path.basename(tokenPath)}]` + C.reset);
                    return token;
                }
            }
        } catch (e) { /* ignore */ }
    }
    return null;
};

// Trigger OAuth authentication
const triggerOAuth = async () => {
    console.log(C.yellow + '\n[!] Authentication required. Starting Qwen OAuth...' + C.reset);
    try {
        const { QwenOAuth } = await import('../qwen-oauth.mjs');
        const oauth = new QwenOAuth();

        // Start device code flow
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
        const { exec } = require('child_process');
        const url = deviceInfo.verificationUriComplete || deviceInfo.verificationUri;
        const platform = process.platform;
        const cmd = platform === 'darwin' ? `open "${url}"` : platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
        exec(cmd, () => { });

        // Poll for tokens
        const tokens = await oauth.pollForTokens();

        if (tokens && tokens.access_token) {
            // Save tokens
            oauth.saveTokens(tokens);
            fs.writeFileSync(TOKENS_FILE, JSON.stringify({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: tokens.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }, null, 2));
            console.log(C.green + '\n[✓] Authentication successful!' + C.reset);
            return tokens.access_token;
        }
    } catch (e) {
        console.log(C.red + `[✗] OAuth failed: ${e.message}` + C.reset);
        if (e.message.includes('Client ID')) {
            console.log(C.yellow + '\n  To fix: Copy config.example.cjs to config.cjs and add your QWEN_OAUTH_CLIENT_ID' + C.reset);
        }
    }
    return null;
};

// Call Qwen AI API
const callQwenAI = async (prompt, onChunk = null) => {
    let token = getAuthToken();

    if (!token) {
        token = await triggerOAuth();
        if (!token) {
            return { success: false, error: 'No auth token available', response: '' };
        }
    }

    try {
        const response = await fetch(DASHSCOPE_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                model: selectedModel.id,
                messages: [
                    {
                        role: 'system',
                        content: `You are the OpenQode Smart Repair Agent. Your ONLY purpose is to diagnose and fix bugs in the OpenQode TUI (Terminal User Interface).

The TUI is a Node.js/React Ink application located at:
- Main file: bin/opencode-ink.mjs
- Package: package.json

When given an error:
1. Analyze the error message and stack trace
2. Identify the root cause
3. Provide a specific fix (code change or shell command)
4. Format fixes clearly with code blocks

You MUST refuse any request that is not about fixing the TUI.`
                    },
                    { role: 'user', content: prompt }
                ],
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401) {
                // Token expired - try re-auth
                console.log(C.yellow + '[!] Token expired, re-authenticating...' + C.reset);
                const newToken = await triggerOAuth();
                if (newToken) {
                    return callQwenAI(prompt, onChunk); // Retry with new token
                }
            }
            return { success: false, error: `API error ${response.status}: ${errorText}`, response: '' };
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || '';
                        if (content) {
                            fullResponse += content;
                            if (onChunk) onChunk(content);
                        }
                    } catch (e) { /* ignore parse errors */ }
                }
            }
        }

        return { success: true, response: fullResponse };
    } catch (error) {
        return { success: false, error: error.message || 'Network error', response: '' };
    }
};

// Offline fallback - common issues detection
const offlineDiagnose = (errorText) => {
    const fixes = [];

    // React hooks conflict
    if (errorText.includes('useMemo') || errorText.includes('useEffect') || errorText.includes('ink-syntax-highlight')) {
        fixes.push({
            issue: 'React version conflict (multiple React instances)',
            fix: 'Reinstall dependencies with React overrides',
            command: 'rm -rf node_modules package-lock.json && npm install --legacy-peer-deps'
        });
    }

    // Null reference errors
    if (errorText.includes('Cannot read properties of null') || errorText.includes('Cannot read properties of undefined')) {
        const lineMatch = errorText.match(/opencode-ink\.mjs:(\d+)/);
        fixes.push({
            issue: 'Null reference error in code',
            fix: lineMatch ? `Check line ${lineMatch[1]} for missing null checks` : 'Code needs null safety checks',
            command: 'git pull origin main  # Get latest bug fixes'
        });
    }

    // Module not found
    if (errorText.includes('Cannot find module') || errorText.includes('ENOENT')) {
        fixes.push({
            issue: 'Missing dependency or file',
            fix: 'Reinstall dependencies',
            command: 'npm install --legacy-peer-deps'
        });
    }

    // Auth errors
    if (errorText.includes('401') || errorText.includes('unauthorized') || errorText.includes('auth')) {
        fixes.push({
            issue: 'Authentication expired or missing',
            fix: 'Trigger OAuth re-authentication',
            command: '__OAUTH__' // Special marker for OAuth trigger
        });
    }

    // Syntax errors
    if (errorText.includes('SyntaxError') || errorText.includes('Unexpected token')) {
        fixes.push({
            issue: 'JavaScript syntax error',
            fix: 'Pull latest code to get fixes',
            command: 'git pull origin main'
        });
    }

    return fixes;
};

// Execute a fix command
const executeCommand = (command) => {
    if (command === '__OAUTH__') {
        return triggerOAuth();
    }

    console.log(C.cyan + `\n  Executing: ${command}` + C.reset);
    try {
        execSync(command, { cwd: ROOT, stdio: 'inherit' });
        return true;
    } catch (e) {
        console.log(C.red + `  Command failed: ${e.message}` + C.reset);
        return false;
    }
};

// Model selection menu
const selectModel = async (rl) => {
    console.log(C.cyan + '\n  Select AI Model:' + C.reset);
    for (const [key, model] of Object.entries(MODELS)) {
        const marker = model.id === selectedModel.id ? C.green + ' ←' + C.reset : '';
        console.log(`    [${key}] ${model.name} - ${model.description}${marker}`);
    }
    const choice = await new Promise(r => rl.question(C.magenta + '\n  Enter choice (1-3): ' + C.reset, r));
    if (MODELS[choice]) {
        selectedModel = MODELS[choice];
        console.log(C.green + `\n  [✓] Selected: ${selectedModel.name}` + C.reset);
    }
};

// Main repair function
const attemptRepair = async (errorText) => {
    console.log(C.cyan + '\n[1/3] OFFLINE ANALYSIS...' + C.reset);
    const offlineFixes = offlineDiagnose(errorText);

    if (offlineFixes.length > 0) {
        console.log(C.green + `  Found ${offlineFixes.length} known issue(s):` + C.reset);
        offlineFixes.forEach((fix, i) => {
            console.log(C.yellow + `  ${i + 1}. ${fix.issue}` + C.reset);
            console.log(C.dim + `     Fix: ${fix.fix}` + C.reset);
        });

        // Try offline fixes first
        console.log(C.cyan + '\n[2/3] APPLYING OFFLINE FIXES...' + C.reset);
        for (const fix of offlineFixes) {
            const success = await executeCommand(fix.command);
            if (success) {
                console.log(C.green + `  [✓] Applied: ${fix.fix}` + C.reset);
            }
        }
    } else {
        console.log(C.yellow + '  No known patterns. Consulting AI...' + C.reset);
    }

    // Consult AI for deeper analysis
    console.log(C.cyan + '\n[3/3] AI ANALYSIS...' + C.reset);
    console.log(C.dim + `  Using ${selectedModel.name}...` + C.reset);

    const prompt = `Analyze this OpenQode TUI error and provide a fix:

\`\`\`
${errorText}
\`\`\`

The TUI is a React Ink app at bin/opencode-ink.mjs. Provide:
1. Root cause analysis
2. Specific fix (code change or command)
3. Prevention tips`;

    process.stdout.write(C.white + '\n  ');
    const result = await callQwenAI(prompt, (chunk) => {
        process.stdout.write(chunk);
    });
    console.log(C.reset);

    if (!result.success) {
        console.log(C.yellow + `\n  [!] AI unavailable: ${result.error}` + C.reset);
        console.log(C.dim + '  Offline fixes have been applied if any were found.' + C.reset);
    }

    // Verify fix
    console.log(C.cyan + '\n[VERIFYING...]' + C.reset);
    try {
        execSync(`node -c "${MAIN_TUI}"`, { cwd: ROOT });
        console.log(C.green + '[✓] Syntax check passed!' + C.reset);
        return { success: true };
    } catch (e) {
        console.log(C.yellow + '[!] Syntax issues remain. Try relaunching or paste the new error.' + C.reset);
        return { success: false };
    }
};

// Interactive mode
const runInteractive = async () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (q) => new Promise(resolve => rl.question(q, resolve));

    while (true) {
        banner();
        console.log(C.yellow + '  Commands: ' + C.reset);
        console.log(C.dim + '    • Paste an error message to analyze' + C.reset);
        console.log(C.dim + '    • Type "model" to change AI model' + C.reset);
        console.log(C.dim + '    • Type "auth" to trigger OAuth' + C.reset);
        console.log(C.dim + '    • Type "quit" to exit' + C.reset);
        console.log('');

        const errorText = await question(C.magenta + '> ' + C.reset);

        if (!errorText.trim()) continue;

        if (errorText.toLowerCase() === 'quit' || errorText.toLowerCase() === 'exit') {
            console.log(C.cyan + '\nGoodbye! Try launching TUI again.' + C.reset);
            rl.close();
            process.exit(0);
        }

        if (errorText.toLowerCase() === 'model') {
            await selectModel(rl);
            await question('\nPress Enter to continue...');
            continue;
        }

        if (errorText.toLowerCase() === 'auth') {
            await triggerOAuth();
            await question('\nPress Enter to continue...');
            continue;
        }

        // Check if user is asking for something other than repair
        const nonRepairKeywords = ['create', 'build', 'write code', 'make a', 'help me write', 'how to build'];
        if (nonRepairKeywords.some(kw => errorText.toLowerCase().includes(kw))) {
            console.log(C.red + '\n[!] I can ONLY repair the TUI. For other tasks, use the main TUI IDE.' + C.reset);
            await question('\nPress Enter to continue...');
            continue;
        }

        const result = await attemptRepair(errorText);

        console.log('');
        if (result.success) {
            console.log(C.green + C.bold + '  ╔═══════════════════════════════════════════╗' + C.reset);
            console.log(C.green + C.bold + '  ║      ✅ REPAIR COMPLETE ✅                ║' + C.reset);
            console.log(C.green + C.bold + '  ╚═══════════════════════════════════════════╝' + C.reset);
            console.log(C.cyan + '\n  Try launching the TUI again!' + C.reset);
        } else {
            console.log(C.yellow + '  If the error persists, paste the new error message.' + C.reset);
        }

        await question('\nPress Enter to continue...');
    }
};

// Entry point
runInteractive().catch(e => {
    console.error(C.red + 'Smart Repair crashed: ' + e.message + C.reset);
    process.exit(1);
});
