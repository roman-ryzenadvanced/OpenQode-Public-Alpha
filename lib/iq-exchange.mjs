/**
 * IQ Exchange - Universal Self-Healing Intelligence Layer
 * 
 * This is the BRAIN that sits between user requests and AI responses.
 * It dynamically:
 * 1. Analyzes any user request
 * 2. Routes to appropriate handler (code, file, browser, desktop, etc.)
 * 3. Executes actions and captures ALL output
 * 4. Detects errors and asks AI to fix them
 * 5. Retries until success or max attempts
 * 
 * Works for ALL task types, not just computer use.
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// System paths
const SYSTEM_PATHS = {
    playwrightBridge: path.join(__dirname, '..', 'bin', 'playwright-bridge.js').replace(/\\/g, '/'),
    inputPs1: path.join(__dirname, '..', 'bin', 'input.ps1').replace(/\\/g, '/'),
    projectRoot: path.join(__dirname, '..').replace(/\\/g, '/')
};

/**
 * Task Type Detection
 */
const TASK_PATTERNS = {
    browser: /\b(website|browser|google|youtube|amazon|navigate|search online|open.*url|go to.*\.com|fill.*form|click.*button)\b/i,
    desktop: /\b(open.*app|launch|click.*menu|type.*text|press.*key|screenshot|notepad|paint|calculator|telegram|discord)\b/i,
    code: /\b(write.*code|create.*file|function|class|module|implement|code.*for|script.*for)\b/i,
    file: /\b(create.*file|write.*file|save.*to|read.*file|edit.*file|delete.*file|rename)\b/i,
    shell: /\b(run.*command|terminal|shell|npm|node|pip|git|docker)\b/i,
    query: /\b(what|how|why|explain|tell me|describe|list|show me)\b/i
};

export function detectTaskType(request) {
    const types = [];
    for (const [type, pattern] of Object.entries(TASK_PATTERNS)) {
        if (pattern.test(request)) {
            types.push(type);
        }
    }
    return types.length > 0 ? types : ['general'];
}

/**
 * Execute any command and capture result
 */
export async function executeAny(command, options = {}) {
    const { timeout = 30000, cwd = SYSTEM_PATHS.projectRoot } = options;

    return new Promise((resolve) => {
        const startTime = Date.now();
        let stdout = '';
        let stderr = '';

        // Parse command to determine execution method
        let proc;

        if (command.includes('playwright-bridge') || command.match(/^node\s/)) {
            // Node.js / Playwright command
            const cleanCmd = command.replace(/^node\s+/, '');
            const parts = cleanCmd.match(/"[^"]+"|'[^']+'|\S+/g) || [];
            const cleanParts = parts.map(p => p.replace(/^["']|["']$/g, ''));

            // Ensure we use absolute path
            let scriptPath = cleanParts[0];
            if (!path.isAbsolute(scriptPath)) {
                scriptPath = path.join(cwd, scriptPath);
            }

            proc = spawn('node', [scriptPath, ...cleanParts.slice(1)], {
                cwd,
                shell: true
            });
        } else if (command.includes('powershell') || command.includes('input.ps1')) {
            // PowerShell command - extract and normalize
            let psCommand;

            if (command.includes('-File')) {
                // Already formatted correctly
                const match = command.match(/-File\s+["']?([^"'\s]+)["']?\s*(.*)/);
                if (match) {
                    const scriptPath = match[1].includes('input.ps1') ? SYSTEM_PATHS.inputPs1 : match[1];
                    const args = match[2];
                    psCommand = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args.split(/\s+/).filter(Boolean)];
                }
            } else {
                // Need to extract script and add proper flags
                if (match) {
                    const argsStr = match[2] || '';
                    // Better regex to handle arguments with spaces inside quotes
                    const args = argsStr.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
                    const cleanArgs = args.map(a => a.startsWith('"') && a.endsWith('"') ? a.slice(1, -1) : a);

                    psCommand = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SYSTEM_PATHS.inputPs1, ...cleanArgs];
                } else {
                    // Just run the command as-is
                    psCommand = ['-Command', command.replace(/^powershell\s*/i, '')];
                }
            }

            console.log("Running:", 'powershell', psCommand.join(' ')); // Debug log
            proc = spawn('powershell', psCommand || [command], { cwd, shell: true });
        } else {
            // Generic command
            proc = spawn('cmd', ['/c', command], { cwd, shell: true });
        }

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            resolve({
                success: code === 0 || stdout.includes('RESULT:'),
                exitCode: code,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                elapsed: Date.now() - startTime,
                command
            });
        });

        proc.on('error', (err) => {
            resolve({
                success: false,
                error: err.message,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                command
            });
        });

        setTimeout(() => {
            proc.kill();
            resolve({
                success: false,
                error: 'TIMEOUT',
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                command
            });
        }, timeout);
    });
}

/**
 * Extract executable code/commands from AI response
 */
export function extractExecutables(response) {
    const executables = [];

    // Match all code blocks
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
        const lang = match[1].toLowerCase();
        const code = match[2].trim();

        if (['bash', 'shell', 'powershell', 'ps1', 'cmd', 'sh'].includes(lang) || lang === '') {
            // Command to execute
            const lines = code.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('//'));
            lines.forEach(line => {
                executables.push({ type: 'command', content: line.trim(), lang });
            });
        } else if (['javascript', 'js', 'typescript', 'ts', 'python', 'py'].includes(lang)) {
            // Code block - might need to write to file
            executables.push({ type: 'code', content: code, lang });
        }
    }

    return executables;
}

/**
 * Check if response indicates task completion
 */
export function isComplete(response) {
    const completionMarkers = [
        'TASK_COMPLETE',
        'task completed',
        'successfully completed',
        'done!',
        'that should work',
        'completed successfully'
    ];
    return completionMarkers.some(m => response.toLowerCase().includes(m.toLowerCase()));
}

/**
 * Check if response indicates an error that needs fixing
 */
export function detectError(result) {
    if (!result.success) return true;

    const errorPatterns = [
        /error:/i,
        /failed/i,
        /exception/i,
        /not found/i,
        /cannot find/i,
        /permission denied/i,
        /ENOENT/i,
        /EACCES/i
    ];

    const output = result.stdout + result.stderr;
    return errorPatterns.some(p => p.test(output));
}

/**
 * Build self-healing prompt for AI
 */
export function buildHealingPrompt(originalRequest, executionHistory, lastError) {
    return `
═══════════════════════════════════════════════════════════════════════════════════
IQ EXCHANGE - SELF-HEALING MODE
═══════════════════════════════════════════════════════════════════════════════════

ORIGINAL REQUEST: "${originalRequest}"

EXECUTION HISTORY:
${executionHistory.map((h, i) => `
[Attempt ${i + 1}]
Command: ${h.command}
Status: ${h.success ? '✅ SUCCESS' : '❌ FAILED'}
Output: ${(h.stdout || h.stderr || h.error || 'No output').substring(0, 500)}
`).join('\n')}

LAST ERROR:
${lastError}

═══════════════════════════════════════════════════════════════════════════════════
AVAILABLE SYSTEM COMMANDS (use EXACT paths):
═══════════════════════════════════════════════════════════════════════════════════

BROWSER (Playwright - all actions in same session):
node "${SYSTEM_PATHS.playwrightBridge}" navigate "URL"
node "${SYSTEM_PATHS.playwrightBridge}" fill "selector" "text"
node "${SYSTEM_PATHS.playwrightBridge}" click "selector"
node "${SYSTEM_PATHS.playwrightBridge}" press "Enter"
node "${SYSTEM_PATHS.playwrightBridge}" type "text"
node "${SYSTEM_PATHS.playwrightBridge}" content

DESKTOP (PowerShell - always use -File flag):
powershell -NoProfile -ExecutionPolicy Bypass -File "${SYSTEM_PATHS.inputPs1}" open "app.exe"
powershell -NoProfile -ExecutionPolicy Bypass -File "${SYSTEM_PATHS.inputPs1}" uiclick "ElementName"
powershell -NoProfile -ExecutionPolicy Bypass -File "${SYSTEM_PATHS.inputPs1}" waitfor "Text" 10
powershell -NoProfile -ExecutionPolicy Bypass -File "${SYSTEM_PATHS.inputPs1}" app_state "WindowName"
powershell -NoProfile -ExecutionPolicy Bypass -File "${SYSTEM_PATHS.inputPs1}" ocr "full"
powershell -NoProfile -ExecutionPolicy Bypass -File "${SYSTEM_PATHS.inputPs1}" keyboard "text"
powershell -NoProfile -ExecutionPolicy Bypass -File "${SYSTEM_PATHS.inputPs1}" key KEYNAME
powershell -NoProfile -ExecutionPolicy Bypass -File "${SYSTEM_PATHS.inputPs1}" mouse X Y
powershell -NoProfile -ExecutionPolicy Bypass -File "${SYSTEM_PATHS.inputPs1}" click
powershell -NoProfile -ExecutionPolicy Bypass -File "${SYSTEM_PATHS.inputPs1}" drag X1 Y1 X2 Y2

═══════════════════════════════════════════════════════════════════════════════════
YOUR TASK:
1. Analyze why the previous attempt failed
2. Provide CORRECTED commands that will work
3. Each command in its own code block
4. If the task is actually complete, just say "TASK_COMPLETE"
═══════════════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Main IQ Exchange Class - The Universal Self-Healing Brain
 */
export class IQExchange {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 5;
        this.sendToAI = options.sendToAI; // Required: async function that sends text to AI and gets response

        // Callbacks
        this.onTaskDetected = options.onTaskDetected || (() => { });
        this.onExecuting = options.onExecuting || (() => { });
        this.onResult = options.onResult || (() => { });
        this.onRetrying = options.onRetrying || (() => { });
        this.onComplete = options.onComplete || (() => { });
        this.onGiveUp = options.onGiveUp || (() => { });
    }

    /**
     * Translate a generic user request into robust executable commands
     * This acts as the "Translation Layer"
     */
    async translateRequest(userRequest) {
        const prompt = `
═══════════════════════════════════════════════════════════════════════════════════
AVAILABLE TOOLS (WINDOWS AUTOMATION):
═══════════════════════════════════════════════════════════════════════════════════
Use the following commands to automate the computer. 
All commands are run via PowerShell using 'bin/input.ps1'.

► VISION & CONTEXT (The Eyes)
  • app_state "App Name"       -> Structural Vision: Dumps the specific UI tree (buttons, inputs) of a window.
  • ocr "region"               -> Textual Vision: READS all text on screen. Use this to find text you can't click.
  • screenshot "file.png"      -> Visual Vision: Captures the screen state.

► NAVIGATION & STATE
  • open "App Name"            -> Launches or focuses an app (e.g. open "Notepad", open "Spotify")
  • waitfor "Text" 10          -> Waits up to 10s for text/element to appear. CRITICAL for reliability.
  • focus "Element Name"       -> Focuses a specific element.

► INTERACTION (Robust UIA Hooks)
  • uiclick "Button Name"      -> Clicks a button/text by name (Reliable).
  • uipress "Item Name"        -> Toggles checkboxes, Selects list items, Expands tree items.
  • type "Text to type"        -> Types text into the focused element.
  • key "Enter"                -> Presses a key (Enter, Tab, Esc, Backspace, Delete).
  • hotkey "Ctrl+C"            -> Presses a key combination.

► FALLBACK (Blind Mouse/Coord)
  • mouse x y                  -> Moves mouse to coordinates.
  • click                      -> Clicks current mouse position.

═══════════════════════════════════════════════════════════════════════════════════
INSTRUCTIONS:
1. Think step-by-step about how to accomplish the User Request.
2. Use 'app_state' or 'ocr' if you need to "see" what is on screen first.
3. Use 'waitfor' to ensure the app is ready before interacting.
4. Use 'uiclick' instead of 'mouse' whenever possible.
5. Output the commands in a single code block.

USER REQUEST: "${userRequest}"
═══════════════════════════════════════════════════════════════════════════════════
Expected Output Format:
\`\`\`powershell
powershell bin/input.ps1 open "Notepad"
powershell bin/input.ps1 waitfor "Untitled" 5
powershell bin/input.ps1 type "Hello World"
\`\`\`
`.trim();

        const response = await this.sendToAI(prompt);
        return extractExecutables(response);
    }

    /**
     * Process a user request with self-healing
     */
    async process(userRequest, aiResponse) {
        // 1. Detect task type
        const taskTypes = detectTaskType(userRequest);
        this.onTaskDetected(taskTypes);

        // 2. Extract executables from AI response
        const executables = extractExecutables(aiResponse);

        if (executables.length === 0) {
            // No commands to execute - just a text response
            return { type: 'text', response: aiResponse };
        }

        // 3. Execute with self-healing loop
        const history = [];
        let retryCount = 0;
        let currentExecutables = executables;

        while (retryCount < this.maxRetries) {
            let allSucceeded = true;

            for (const exec of currentExecutables) {
                if (exec.type === 'command') {
                    this.onExecuting(exec.content);

                    const result = await executeAny(exec.content);
                    history.push(result);
                    this.onResult(result);

                    if (detectError(result)) {
                        allSucceeded = false;

                        // Ask AI to fix
                        retryCount++;
                        this.onRetrying({ attempt: retryCount, error: result.stderr || result.error });

                        const healingPrompt = buildHealingPrompt(
                            userRequest,
                            history,
                            result.stderr || result.error || result.stdout
                        );

                        const correctedResponse = await this.sendToAI(healingPrompt);

                        if (isComplete(correctedResponse)) {
                            return { type: 'complete', history, retries: retryCount };
                        }

                        currentExecutables = extractExecutables(correctedResponse);
                        break; // Restart with new commands
                    }
                }
            }

            if (allSucceeded) {
                this.onComplete({ history, retries: retryCount });
                return { type: 'complete', history, retries: retryCount };
            }
        }

        // Max retries reached
        this.onGiveUp({ history, retries: retryCount });
        return { type: 'failed', history, retries: retryCount };
    }
}

export default {
    IQExchange,
    detectTaskType,
    executeAny,
    extractExecutables,
    isComplete,
    detectError,
    buildHealingPrompt,
    SYSTEM_PATHS
};
