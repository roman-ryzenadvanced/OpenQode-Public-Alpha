/**
 * Qwen API Bridge for Electron
 * Handles authentication and API calls to Qwen
 */

import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPENCODE_ROOT = path.resolve(__dirname, '..');

// Dynamic import of QwenOAuth
let qwen = null;

async function getQwen() {
    if (!qwen) {
        // Convert Windows path to proper file:// URL for ESM imports
        const qwenOAuthPath = path.join(OPENCODE_ROOT, 'qwen-oauth.mjs');
        const qwenOAuthUrl = pathToFileURL(qwenOAuthPath).href;
        const { QwenOAuth } = await import(qwenOAuthUrl);
        qwen = new QwenOAuth();
    }
    return qwen;
}

// Available models
const MODELS = [
    { id: 'qwen-coder-plus', name: 'Qwen Coder Plus', context: 131072 },
    { id: 'qwen-plus', name: 'Qwen Plus', context: 1000000 },
    { id: 'qwen-turbo', name: 'Qwen Turbo', context: 1000000 }
];

/**
 * Check if user is authenticated
 */
export async function checkAuth() {
    try {
        const qwenClient = await getQwen();
        const result = await qwenClient.checkAuth();
        // QwenOAuth.checkAuth returns { authenticated: bool, method: string, ... }
        return {
            authenticated: result.authenticated === true,
            method: result.method,
            hasVisionSupport: result.hasVisionSupport
        };
    } catch (e) {
        return { authenticated: false, error: e.message };
    }
}

/**
 * Get available models
 */
export function getModels() {
    return MODELS;
}

/**
 * Send a message and get full response (non-streaming)
 */
export async function sendMessage(message, model = 'qwen-coder-plus') {
    try {
        const qwenClient = await getQwen();
        const result = await qwenClient.sendMessage(message, model);
        return { success: result.success, response: result.response, error: result.error };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Send a vision message (image + text) and get full response (non-streaming)
 */
export async function sendVisionMessage(message, imageData, model = 'qwen-vl-plus') {
    try {
        const qwenClient = await getQwen();
        const result = await qwenClient.sendVisionMessage(message, imageData, model);
        return { success: result.success, response: result.response, error: result.error };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Stream a message with callbacks
 */
export async function streamMessage(message, model = 'qwen-coder-plus', callbacks = {}) {
    const { onChunk, onComplete, onError } = callbacks;

    try {
        const qwenClient = await getQwen();

        // Build system prompt for Goose with Internal-First Policy
        const systemPrompt = `You are Goose AI Super, an advanced AI developer and agent running inside an Electron IDE.

⚠️ CRITICAL POLICY: "INTERNAL TOOLS FIRST"
You have two modes of operation. You must choose the correct one based on the user's request:

### 1. 🏠 INTERNAL MODE (DEFAULT - 99% of tasks)
For coding, building apps, web browsing, and general assistance.
- **BUILDING/CODING**: Use the **Built-in Editor** ([ACTION:OPEN_EDITOR]) and **App Preview** ([ACTION:PREVIEW]).
  - NEVER open Notepad, VS Code, or external terminals for coding.
  - ALWAYS output full code files (index.html, style.css, script.js) for the internal preview.
- **BROWSING**: Use the **Built-in Browser** ([ACTION:BROWSER_NAVIGATE]).
  - NEVER launch Chrome/Edge unless explicitly asked.

### 2. 🖥️ DESKTOP MODE (RESTRICTED - Explicit Request Only)
Only when the user SPECIFICALLY asks to "use my computer", "take a screenshot", "click on X", or "automate my desktop".
- Capabilities: [ACTION:SCREENSHOT], [ACTION:CLICK], [ACTION:TYPE], [ACTION:OPEN_APP].

---

## 🛠️ ACTION COMMANDS (Use these to perform tasks)

### 📝 CODING & BUILDING (Internal)
[ACTION:OPEN_EDITOR] -> Opens the built-in Monaco editor
[ACTION:PREVIEW url="file:///..."] -> Opens the built-in preview panel
[ACTION:FILE_WRITE path="index.html" content="..."] -> Writes to the internal workspace

### 🌐 BROWSING (Internal)
[ACTION:BROWSER_NAVIGATE url="https://google.com"] -> Navigates the internal webview & Playwright
[ACTION:BROWSER_CLICK selector="#btn"] -> Clicks element in internal webview
[ACTION:BROWSER_TYPE text="hello"] -> Types in internal webview

### 🖥️ DESKTOP AUTOMATION (⚠️ ONLY if explicitly requested)
[ACTION:SCREENSHOT] -> Captures desktop
[ACTION:CLICK x=100 y=200] -> Clicks desktop coordinates
[ACTION:TYPE text="hello"] -> Types on desktop
[ACTION:OPEN_APP app="notepad"] -> Launches external app

---

## 🧠 INTELLIGENT BEHAVIOR RULES

1. **BUILD TASKS (Calculators, Games, Websites):**
   - **DO NOT** use IQ Exchange or "Plan". Just **DO IT**.
   - **STREAM** the code directly.
   - Output **FENCED CODE BLOCKS** (\`\`\`html, \`\`\`css, \`\`\`js) for all files.
   - My system will automatically capture these blocks, save them, and open the Preview.
   - **Right:** "Here is the code for the calculator..." followed by code blocks.
   - **Wrong:** [ACTION:OPEN_APP app="textedit"] (VIOLATION!)

2. **WEB SEARCH / BROWSING:**
   - Use the **Internal Browser** by default.
   - [ACTION:BROWSER_NAVIGATE url="https://google.com"]

3. **COMPLEX DESKTOP TASKS:**
   - If user asks: "Use my computer to check spotify", THEN use [ACTION:SCREENSHOT] and desktop tools.
   - Use [ACTION:IQ_EXCHANGE task="..."] for multistep desktop navigation.

4. **VISION:**
   - If user asks to find/click something on the DESKTOP, take a [ACTION:SCREENSHOT] first.

## EXAMPLES:

User: "Build a todo app"
You: I'll create a To-Do app using the built-in editor.
(Proceeds to output \`\`\`html, \`\`\`css, \`\`\`js blocks immediately)

User: "Search google for weather"
You: Searching in internal browser...
[ACTION:BROWSER_NAVIGATE url="https://google.com/search?q=weather"]

User: "Open notepad on my computer and type hi"
You: (User explicitly asked for desktop) Opening Notepad...
[ACTION:OPEN_APP app="notepad"]
[ACTION:TYPE text="hi"]

User: "Click on the start menu"
You: (User explicitly asked for desktop) Taking screenshot to locate it...
[ACTION:SCREENSHOT]

Current context:
- Platform: ${process.platform}
- Workdir: ${process.cwd()}
- Time: ${new Date().toISOString()}`;

        let fullResponse = '';

        // Use sendMessage with onChunk callback for streaming
        const result = await qwenClient.sendMessage(
            message,
            model,
            null, // no image data
            (chunk) => {
                fullResponse += chunk;
                if (onChunk) onChunk(chunk);
            },
            systemPrompt
        );

        if (result.success) {
            // If we got chunks, use fullResponse; otherwise use result.response
            const finalResponse = fullResponse || result.response || '';
            if (onComplete) onComplete(finalResponse);
        } else {
            if (onError) onError(result.error || 'Unknown error');
        }

    } catch (e) {
        console.error('Stream message error:', e);
        if (onError) onError(e.message || String(e));
    }
}

export default {
    checkAuth,
    getModels,
    sendMessage,
    streamMessage
};
