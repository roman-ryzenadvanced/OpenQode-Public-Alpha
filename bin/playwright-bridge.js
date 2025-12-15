#!/usr/bin/env node
/**
 * Playwright Bridge for OpenQode TUI - Persistent Session Version
 * Uses CDP to maintain browser session across multiple command invocations
 * 
 * Credit: Inspired by browser-use/browser-use (https://github.com/browser-use/browser-use)
 * License: MIT
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const net = require('net');

// State file to persist CDP endpoint between calls
const STATE_FILE = path.join(__dirname, '.playwright-session.json');
const CDP_PORT = 9222;

let browser = null;
let page = null;

/**
 * Check if a port is in use
 */
function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(true));
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port, '127.0.0.1');
    });
}

/**
 * Load saved session state
 */
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        }
    } catch (e) { }
    return null;
}

/**
 * Save session state
 */
function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Clear session state
 */
function clearState() {
    if (fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
    }
}

/**
 * Launch browser with CDP enabled or connect to existing one
 */
async function ensureBrowser() {
    const state = loadState();

    // Try to connect to existing browser first
    if (state && state.wsEndpoint) {
        try {
            browser = await chromium.connectOverCDP(state.wsEndpoint);
            const contexts = browser.contexts();
            if (contexts.length > 0) {
                const pages = contexts[0].pages();
                page = pages.length > 0 ? pages[0] : await contexts[0].newPage();
            } else {
                const context = await browser.newContext({ viewport: null });
                page = await context.newPage();
            }
            return { browser, page };
        } catch (e) {
            // Connection failed, browser might have closed
            clearState();
        }
    }

    // Check if CDP port is already in use
    const portInUse = await isPortInUse(CDP_PORT);

    if (portInUse) {
        // Try to connect to existing browser on that port
        try {
            browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
            const wsEndpoint = `http://127.0.0.1:${CDP_PORT}`;
            saveState({ wsEndpoint });

            const contexts = browser.contexts();
            if (contexts.length > 0) {
                const pages = contexts[0].pages();
                page = pages.length > 0 ? pages[0] : await contexts[0].newPage();
            } else {
                const context = await browser.newContext({ viewport: null });
                page = await context.newPage();
            }
            return { browser, page };
        } catch (e) {
            console.log('Could not connect to existing browser, launching new one...');
        }
    }

    // Launch new browser with CDP enabled
    browser = await chromium.launch({
        headless: false,
        args: [
            '--start-maximized',
            `--remote-debugging-port=${CDP_PORT}`
        ]
    });

    // Get the WebSocket endpoint
    const wsEndpoint = `http://127.0.0.1:${CDP_PORT}`;
    saveState({ wsEndpoint, launchTime: Date.now() });

    const context = await browser.newContext({ viewport: null });
    page = await context.newPage();

    console.log('Browser launched with persistent session');
    return { browser, page };
}

/**
 * Run multiple commands in sequence (for batch execution)
 */
async function runBatch(commands) {
    await ensureBrowser();
    const results = [];

    for (const cmd of commands) {
        try {
            const result = await executeCommand(cmd.command, cmd.args);
            results.push({ success: true, command: cmd.command, result });
        } catch (e) {
            results.push({ success: false, command: cmd.command, error: e.message });
        }
    }

    return results;
}

/**
 * Execute a single command
 */
async function executeCommand(command, args) {
    switch (command) {
        case 'navigate': {
            const url = args[0];
            if (!url) throw new Error('URL required');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            const title = await page.title();
            return { navigated: url, title };
        }

        case 'fill': {
            const selector = args[0];
            const text = args.slice(1).join(' ');
            if (!selector || !text) throw new Error('Selector and text required');

            try {
                await page.fill(selector, text, { timeout: 5000 });
            } catch (e) {
                try {
                    await page.getByPlaceholder(selector).fill(text, { timeout: 5000 });
                } catch (e2) {
                    await page.getByLabel(selector).fill(text, { timeout: 5000 });
                }
            }
            return { filled: selector, text };
        }

        case 'click': {
            const selector = args.join(' ');
            if (!selector) throw new Error('Selector required');

            try {
                await page.click(selector, { timeout: 5000 });
            } catch (e) {
                try {
                    await page.click(`text="${selector}"`, { timeout: 5000 });
                } catch (e2) {
                    try {
                        await page.getByRole('button', { name: selector }).click({ timeout: 5000 });
                    } catch (e3) {
                        await page.getByText(selector).first().click({ timeout: 5000 });
                    }
                }
            }
            return { clicked: selector };
        }

        case 'press': {
            const key = args[0];
            if (!key) throw new Error('Key required');
            await page.keyboard.press(key);
            return { pressed: key };
        }

        case 'type': {
            const text = args.join(' ');
            if (!text) throw new Error('Text required');
            await page.keyboard.type(text);
            return { typed: text };
        }

        case 'screenshot': {
            const filename = args[0] || 'screenshot.png';
            const fullPath = path.resolve(filename);
            await page.screenshot({ path: fullPath, fullPage: true });
            return { screenshot: fullPath };
        }

        case 'content': {
            const content = await page.textContent('body');
            return { content: content?.substring(0, 5000) };
        }

        case 'title': {
            return { title: await page.title() };
        }

        case 'url': {
            return { url: page.url() };
        }

        case 'elements': {
            const elements = await page.evaluate(() => {
                const els = document.querySelectorAll('button, a, input, textarea, select, [role="button"]');
                return Array.from(els).slice(0, 30).map((el, i) => ({
                    i,
                    tag: el.tagName.toLowerCase(),
                    text: el.textContent?.trim().substring(0, 40) || '',
                    name: el.name || el.id || ''
                })).filter(e => e.text || e.name);
            });
            return { elements };
        }

        case 'wait': {
            const selector = args[0];
            const timeout = parseInt(args[1]) || 10000;
            await page.waitForSelector(selector, { timeout });
            return { waited: selector };
        }

        case 'close': {
            if (browser) {
                await browser.close();
                browser = null;
                page = null;
            }
            clearState();
            return { closed: true };
        }

        default:
            throw new Error(`Unknown command: ${command}`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0]?.toLowerCase();

    if (!command) {
        console.log('Playwright Bridge - Persistent Session');
        console.log('Commands: navigate, fill, click, press, type, screenshot, content, title, url, elements, wait, close');
        console.log('');
        console.log('Example: node playwright-bridge.js navigate https://google.com');
        return;
    }

    // Special batch mode for multiple commands
    if (command === 'batch') {
        const batchFile = args[1];
        if (batchFile && fs.existsSync(batchFile)) {
            const commands = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
            const results = await runBatch(commands);
            console.log(JSON.stringify(results, null, 2));
        }
        return;
    }

    try {
        await ensureBrowser();
        const result = await executeCommand(command, args.slice(1));
        console.log(`RESULT:${JSON.stringify(result)}`);
    } catch (error) {
        console.error(`ERROR:${error.message}`);
        process.exit(1);
    }
}

// Keep process alive briefly to allow CDP connection to stabilize
process.on('beforeExit', async () => {
    // Don't close browser on exit - keep it persistent!
});

main().catch(console.error);
