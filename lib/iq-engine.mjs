/**
 * Intelligent Execution Engine (IQ Exchange Core)
 * 
 * This module is the "brain" that:
 * 1. Takes natural language requests
 * 2. Uses AI to generate commands
 * 3. Executes commands and captures results
 * 4. Detects errors and sends them back to AI for correction
 * 5. Retries until task is complete or max retries reached
 * 
 * Credit: Inspired by AmberSahdev/Open-Interface & browser-use/browser-use
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Absolute paths - critical for reliable execution
const PATHS = {
    playwrightBridge: path.join(__dirname, '..', 'bin', 'playwright-bridge.js'),
    inputPs1: path.join(__dirname, '..', 'bin', 'input.ps1'),
    screenshotDir: path.join(__dirname, '..', 'screenshots')
};

// Ensure screenshot dir exists
if (!fs.existsSync(PATHS.screenshotDir)) {
    fs.mkdirSync(PATHS.screenshotDir, { recursive: true });
}

/**
 * Execute a single command and return result
 */
export async function executeCommand(commandString, timeout = 30000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        let proc;
        let stdout = '';
        let stderr = '';

        try {
            // Parse command type and execute appropriately
            if (commandString.includes('playwright-bridge') || commandString.startsWith('node')) {
                // Playwright command
                const parts = parseCommandParts(commandString);
                proc = spawn('node', parts.args, {
                    cwd: path.dirname(PATHS.playwrightBridge),
                    shell: true
                });
            } else if (commandString.includes('powershell') || commandString.includes('input.ps1')) {
                // PowerShell command - ensure proper format
                const scriptMatch = commandString.match(/(?:-File\s+)?["']?([^"'\s]+input\.ps1)["']?\s+(.+)/i);
                if (scriptMatch) {
                    const scriptPath = PATHS.inputPs1;
                    const cmdArgs = scriptMatch[2];
                    proc = spawn('powershell', [
                        '-NoProfile', '-ExecutionPolicy', 'Bypass',
                        '-File', scriptPath,
                        ...cmdArgs.split(/\s+/)
                    ], { shell: true });
                } else {
                    // Try to parse as simple command
                    proc = spawn('powershell', [commandString], { shell: true });
                }
            } else {
                // Generic shell command
                proc = spawn('cmd', ['/c', commandString], { shell: true });
            }

            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });

            proc.on('close', (code) => {
                const elapsed = Date.now() - startTime;
                resolve({
                    success: code === 0,
                    exitCode: code,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    elapsed,
                    command: commandString
                });
            });

            proc.on('error', (err) => {
                resolve({
                    success: false,
                    error: err.message,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    elapsed: Date.now() - startTime,
                    command: commandString
                });
            });

            // Timeout
            setTimeout(() => {
                proc.kill();
                resolve({
                    success: false,
                    error: 'TIMEOUT',
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    elapsed: timeout,
                    command: commandString
                });
            }, timeout);

        } catch (error) {
            resolve({
                success: false,
                error: error.message,
                command: commandString
            });
        }
    });
}

/**
 * Parse command string into parts
 */
function parseCommandParts(commandString) {
    const matches = commandString.match(/"[^"]+"|'[^']+'|\S+/g) || [];
    const clean = matches.map(m => m.replace(/^["']|["']$/g, ''));
    return { args: clean.slice(1), full: clean };
}

/**
 * Extract code blocks from AI response
 */
export function extractCodeBlocks(response) {
    const blocks = [];
    const regex = /```(?:bash|powershell|shell|cmd)?\s*([\s\S]*?)```/gi;
    let match;

    while ((match = regex.exec(response)) !== null) {
        const code = match[1].trim();
        const lines = code.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        blocks.push(...lines);
    }

    return blocks;
}

/**
 * Build context for AI to understand current state and errors
 */
export function buildCorrectionContext(originalRequest, attemptHistory, currentError) {
    let context = `
╔══════════════════════════════════════════════════════════════════════════════════╗
║  IQ EXCHANGE - SELF-HEALING EXECUTION ENGINE                                     ║
╚══════════════════════════════════════════════════════════════════════════════════╝

ORIGINAL USER REQUEST: "${originalRequest}"

SYSTEM PATHS (use these EXACT paths):
- Playwright: node "${PATHS.playwrightBridge}"
- PowerShell: powershell -NoProfile -ExecutionPolicy Bypass -File "${PATHS.inputPs1}"

`;

    if (attemptHistory.length > 0) {
        context += `\nPREVIOUS ATTEMPTS:\n`;
        attemptHistory.forEach((attempt, i) => {
            context += `
═════ ATTEMPT ${i + 1} ═════
Command: ${attempt.command}
Result: ${attempt.success ? 'SUCCESS' : 'FAILED'}
Output: ${attempt.stdout || attempt.stderr || attempt.error || 'No output'}
`;
        });
    }

    if (currentError) {
        context += `
⚠️ CURRENT ERROR TO FIX:
${currentError}

ANALYZE the error and provide CORRECTED commands.
Common fixes:
- Wrong path → Use the EXACT paths shown above
- Element not found → Use different selector or wait for element
- Timeout → Increase wait time or check if page loaded
- Permission denied → Check file/folder permissions
`;
    }

    context += `
═══════════════════════════════════════════════════════════════════════════════════
INSTRUCTIONS:
1. Analyze what went wrong
2. Provide CORRECTED commands that will work
3. Each command in its own code block
4. If task is complete, say "TASK_COMPLETE"

AVAILABLE COMMANDS:
Browser (Playwright): navigate, fill, click, press, type, content, elements, screenshot
Desktop (PowerShell): open, uiclick, type, key, mouse, click, drag, apps, focus, screenshot, ocr

Respond with corrected commands in code blocks:
`;

    return context;
}

/**
 * The main intelligent execution loop
 */
export class IntelligentExecutor {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 5;
        this.sendToAI = options.sendToAI; // Must be provided - sends text to AI, receives response
        this.onExecuting = options.onExecuting || (() => { });
        this.onResult = options.onResult || (() => { });
        this.onRetry = options.onRetry || (() => { });
        this.onComplete = options.onComplete || (() => { });
        this.onError = options.onError || (() => { });
    }

    /**
     * Execute a user request with intelligent retry
     */
    async execute(userRequest, initialCommands = []) {
        const attemptHistory = [];
        let commands = initialCommands;
        let retryCount = 0;
        let allSucceeded = false;

        while (retryCount < this.maxRetries && !allSucceeded) {
            // If no commands yet, ask AI to generate them
            if (commands.length === 0) {
                const context = buildCorrectionContext(userRequest, attemptHistory, null);
                const aiResponse = await this.sendToAI(context);
                commands = extractCodeBlocks(aiResponse);

                if (commands.length === 0) {
                    // AI didn't provide commands
                    this.onError({
                        type: 'no_commands',
                        message: 'AI did not provide executable commands',
                        response: aiResponse
                    });
                    break;
                }
            }

            // Execute each command
            let hadError = false;
            for (let i = 0; i < commands.length; i++) {
                const cmd = commands[i];
                this.onExecuting({ command: cmd, index: i, total: commands.length });

                const result = await executeCommand(cmd);
                attemptHistory.push(result);
                this.onResult(result);

                if (!result.success) {
                    hadError = true;

                    // Ask AI to fix the error
                    const errorContext = buildCorrectionContext(
                        userRequest,
                        attemptHistory,
                        result.stderr || result.error || 'Command failed'
                    );

                    this.onRetry({
                        attempt: retryCount + 1,
                        maxRetries: this.maxRetries,
                        error: result.stderr || result.error
                    });

                    const correctedResponse = await this.sendToAI(errorContext);

                    // Check if task is complete despite error
                    if (correctedResponse.includes('TASK_COMPLETE')) {
                        allSucceeded = true;
                        break;
                    }

                    // Get corrected commands
                    commands = extractCodeBlocks(correctedResponse);
                    retryCount++;
                    break; // Restart with new commands
                }
            }

            if (!hadError) {
                allSucceeded = true;
            }
        }

        const finalResult = {
            success: allSucceeded,
            attempts: attemptHistory.length,
            retries: retryCount,
            history: attemptHistory
        };

        if (allSucceeded) {
            this.onComplete(finalResult);
        } else {
            this.onError({ type: 'max_retries', ...finalResult });
        }

        return finalResult;
    }
}

/**
 * Quick execution helper for simple cases
 */
export async function quickExecute(commands, onResult = console.log) {
    const results = [];
    for (const cmd of commands) {
        const result = await executeCommand(cmd);
        results.push(result);
        onResult(result);
        if (!result.success) break;
    }
    return results;
}

export default {
    executeCommand,
    extractCodeBlocks,
    buildCorrectionContext,
    IntelligentExecutor,
    quickExecute,
    PATHS
};
