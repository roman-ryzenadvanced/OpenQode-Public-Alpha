/**
 * Vision Loop - Automatic Visual Feedback Automation
 * Implements the "screenshot → LLM → action → repeat" pattern
 * 
 * Credit: Inspired by AmberSahdev/Open-Interface (https://github.com/AmberSahdev/Open-Interface)
 * License: MIT
 * 
 * This module provides:
 * 1. Screenshot capture
 * 2. Vision model analysis
 * 3. Action extraction and execution
 * 4. Course correction (retry on failure)
 * 5. Goal completion detection
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Configuration
const CONFIG = {
    maxIterations: 20,         // Maximum steps before giving up
    screenshotDelay: 500,      // ms to wait after action before screenshot
    actionTimeout: 10000,      // ms timeout for each action
    screenshotDir: 'screenshots',
    inputScript: 'bin/input.ps1'
};

/**
 * Execute a PowerShell command via input.ps1
 */
export async function executeAction(command, args = []) {
    return new Promise((resolve, reject) => {
        const fullArgs = [CONFIG.inputScript, command, ...args];
        const proc = spawn('powershell', ['-File', ...fullArgs], {
            cwd: process.cwd(),
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

        // Timeout
        setTimeout(() => {
            proc.kill();
            reject(new Error('Action timeout'));
        }, CONFIG.actionTimeout);
    });
}

/**
 * Capture screenshot and return path
 */
export async function captureScreenshot(filename = null) {
    const dir = path.resolve(CONFIG.screenshotDir);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const file = filename || `screenshot_${Date.now()}.png`;
    const fullPath = path.join(dir, file);

    const result = await executeAction('screenshot', [fullPath]);

    if (result.success && fs.existsSync(fullPath)) {
        return fullPath;
    }

    throw new Error('Failed to capture screenshot: ' + result.error);
}

/**
 * Get list of open applications/windows
 */
export async function getOpenApps() {
    const result = await executeAction('apps');
    return result.output;
}

/**
 * Parse LLM response for actions
 * Extracts PowerShell commands from code blocks
 */
export function parseActionsFromResponse(response) {
    const actions = [];

    // Match PowerShell code blocks
    const codeBlockRegex = /```(?:powershell)?\s*([\s\S]*?)```/gi;
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
        const code = match[1].trim();
        // Parse individual commands
        const lines = code.split('\n').filter(l => l.trim() && !l.startsWith('#'));

        for (const line of lines) {
            // Extract input.ps1 commands
            const inputMatch = line.match(/(?:powershell\s+)?(?:\.\\)?bin[\/\\]input\.ps1\s+(\w+)\s*(.*)/i);
            if (inputMatch) {
                actions.push({
                    type: 'input',
                    command: inputMatch[1],
                    args: inputMatch[2] ? inputMatch[2].trim().split(/\s+/) : []
                });
            }
        }
    }

    return actions;
}

/**
 * Check if goal is complete based on LLM response
 */
export function isGoalComplete(response) {
    const completionIndicators = [
        'task completed',
        'goal achieved',
        'successfully completed',
        'done',
        'finished',
        'completed successfully',
        'mission accomplished'
    ];

    const lowerResponse = response.toLowerCase();
    return completionIndicators.some(indicator => lowerResponse.includes(indicator));
}

/**
 * Vision Loop State Machine
 */
export class VisionLoop {
    constructor(options = {}) {
        this.maxIterations = options.maxIterations || CONFIG.maxIterations;
        this.onStep = options.onStep || (() => { });
        this.onAction = options.onAction || (() => { });
        this.onComplete = options.onComplete || (() => { });
        this.onError = options.onError || (() => { });
        this.sendToLLM = options.sendToLLM || null; // Must be provided

        this.iteration = 0;
        this.history = [];
        this.isRunning = false;
    }

    /**
     * Start the vision loop
     * @param {string} goal - The user's goal/task description
     */
    async run(goal) {
        if (!this.sendToLLM) {
            throw new Error('sendToLLM callback must be provided');
        }

        this.isRunning = true;
        this.iteration = 0;
        this.history = [];

        // Initial context gathering
        const apps = await getOpenApps();

        while (this.isRunning && this.iteration < this.maxIterations) {
            this.iteration++;

            try {
                // Step 1: Capture current state
                const screenshotPath = await captureScreenshot(`step_${this.iteration}.png`);

                this.onStep({
                    iteration: this.iteration,
                    phase: 'capture',
                    screenshot: screenshotPath
                });

                // Step 2: Build context for LLM
                const context = this.buildContext(goal, apps, screenshotPath);

                // Step 3: Ask LLM for next action
                const response = await this.sendToLLM(context);

                this.history.push({
                    iteration: this.iteration,
                    context: context.substring(0, 500) + '...',
                    response: response.substring(0, 500) + '...'
                });

                // Step 4: Check if goal is complete
                if (isGoalComplete(response)) {
                    this.onComplete({
                        iterations: this.iteration,
                        history: this.history
                    });
                    this.isRunning = false;
                    return { success: true, iterations: this.iteration };
                }

                // Step 5: Parse and execute actions
                const actions = parseActionsFromResponse(response);

                if (actions.length === 0) {
                    // LLM didn't provide actions, might need clarification
                    this.onError({
                        type: 'no_actions',
                        response: response,
                        iteration: this.iteration
                    });
                    continue;
                }

                for (const action of actions) {
                    this.onAction({
                        iteration: this.iteration,
                        action: action
                    });

                    const result = await executeAction(action.command, action.args);

                    if (!result.success) {
                        this.onError({
                            type: 'action_failed',
                            action: action,
                            error: result.error,
                            iteration: this.iteration
                        });
                    }

                    // Wait for UI to update
                    await new Promise(resolve => setTimeout(resolve, CONFIG.screenshotDelay));
                }

            } catch (error) {
                this.onError({
                    type: 'exception',
                    error: error.message,
                    iteration: this.iteration
                });
            }
        }

        if (this.iteration >= this.maxIterations) {
            return { success: false, reason: 'max_iterations', iterations: this.iteration };
        }

        return { success: false, reason: 'stopped', iterations: this.iteration };
    }

    /**
     * Build context/prompt for LLM
     */
    buildContext(goal, apps, screenshotPath) {
        const historyContext = this.history.slice(-3).map(h =>
            `Step ${h.iteration}: ${h.response.substring(0, 200)}...`
        ).join('\n');

        return `# Vision Loop - Autonomous Computer Control
Credit: Inspired by AmberSahdev/Open-Interface

## Current Goal
${goal}

## Current State
- Iteration: ${this.iteration}/${this.maxIterations}
- Screenshot: ${screenshotPath}
- Open Applications:
${apps}

## Recent History
${historyContext || 'No previous actions'}

## Instructions
1. Analyze the current state based on the screenshot path and open apps
2. Determine the next action(s) to achieve the goal
3. Provide PowerShell commands using bin/input.ps1
4. If the goal is complete, say "Task completed"

## Available Commands
- powershell bin/input.ps1 key LWIN - Press Windows key
- powershell bin/input.ps1 uiclick "Element Name" - Click UI element
- powershell bin/input.ps1 type "text" - Type text
- powershell bin/input.ps1 click - Left click at current position
- powershell bin/input.ps1 mouse X Y - Move mouse
- powershell bin/input.ps1 apps - List open windows

## Response Format
Provide your analysis and commands in PowerShell code blocks:
\`\`\`powershell
powershell bin/input.ps1 [command] [args]
\`\`\`
`;
    }

    /**
     * Stop the loop
     */
    stop() {
        this.isRunning = false;
    }
}

/**
 * Simple one-shot action execution (no loop)
 */
export async function executeOneShot(commands) {
    const results = [];

    for (const cmd of commands) {
        const result = await executeAction(cmd.command, cmd.args);
        results.push({
            command: cmd,
            result: result
        });

        if (!result.success) {
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
}

export default {
    VisionLoop,
    executeAction,
    captureScreenshot,
    getOpenApps,
    parseActionsFromResponse,
    isGoalComplete,
    executeOneShot
};
