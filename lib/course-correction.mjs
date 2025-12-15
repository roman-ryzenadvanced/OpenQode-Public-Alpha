/**
 * Course Correction - Automated Verification and Retry
 * Verifies action success and retries on failure
 * 
 * Credit: Inspired by AmberSahdev/Open-Interface (https://github.com/AmberSahdev/Open-Interface)
 * License: MIT
 */

import { executeAction, captureScreenshot, getOpenApps } from './vision-loop.mjs';

// Configuration
const CONFIG = {
    maxRetries: 3,
    retryDelay: 500,
    verificationDelay: 300
};

/**
 * Verification strategies
 */
const VERIFICATION_STRATEGIES = {
    /**
     * Verify element exists after action
     */
    elementExists: async (elementName) => {
        const result = await executeAction('find', [elementName]);
        return result.success && result.output.includes('Found');
    },

    /**
     * Verify element does NOT exist (for close/delete actions)
     */
    elementGone: async (elementName) => {
        const result = await executeAction('find', [elementName]);
        return result.success && result.output.includes('not found');
    },

    /**
     * Verify window with title exists
     */
    windowExists: async (titlePattern) => {
        const apps = await getOpenApps();
        return apps.toLowerCase().includes(titlePattern.toLowerCase());
    },

    /**
     * Verify window closed
     */
    windowClosed: async (titlePattern) => {
        const apps = await getOpenApps();
        return !apps.toLowerCase().includes(titlePattern.toLowerCase());
    },

    /**
     * Verify text appears on screen (via OCR)
     */
    textAppears: async (text) => {
        // Take quick screenshot and OCR
        try {
            const screenshotPath = await captureScreenshot('verify_temp.png');
            const ocrResult = await executeAction('ocr', [screenshotPath]);
            return ocrResult.output.toLowerCase().includes(text.toLowerCase());
        } catch {
            return false;
        }
    },

    /**
     * Verify color at position
     */
    colorAt: async (x, y, expectedColor) => {
        const result = await executeAction('color', [String(x), String(y)]);
        return result.output.includes(expectedColor);
    }
};

/**
 * Execute action with automatic verification and retry
 */
export async function executeWithVerification(action, verification = null, options = {}) {
    const maxRetries = options.maxRetries || CONFIG.maxRetries;
    const retryDelay = options.retryDelay || CONFIG.retryDelay;

    let lastResult = null;
    let verified = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Execute the action
        lastResult = await executeAction(action.command, action.args);

        if (!lastResult.success) {
            console.log(`Attempt ${attempt}/${maxRetries}: Action failed - ${lastResult.error}`);
            if (attempt < maxRetries) {
                await sleep(retryDelay);
                continue;
            }
        }

        // Wait for UI to update
        await sleep(CONFIG.verificationDelay);

        // Verify if verification strategy provided
        if (verification) {
            try {
                verified = await verification();
                if (verified) {
                    return {
                        success: true,
                        attempts: attempt,
                        output: lastResult.output
                    };
                } else {
                    console.log(`Attempt ${attempt}/${maxRetries}: Verification failed, retrying...`);
                }
            } catch (verifyError) {
                console.log(`Attempt ${attempt}/${maxRetries}: Verification error - ${verifyError.message}`);
            }
        } else {
            // No verification, just return success
            return {
                success: true,
                attempts: attempt,
                output: lastResult.output
            };
        }

        if (attempt < maxRetries) {
            await sleep(retryDelay);
        }
    }

    return {
        success: false,
        attempts: maxRetries,
        output: lastResult?.output || '',
        error: 'Max retries exceeded, verification failed'
    };
}

/**
 * Smart action executor with automatic verification selection
 */
export async function smartExecute(action) {
    const { command, args } = action;

    // Select verification strategy based on action type
    let verification = null;

    switch (command) {
        case 'uiclick':
            // After clicking, element should still exist (or dialog opened)
            verification = () => VERIFICATION_STRATEGIES.elementExists(args[0]);
            break;

        case 'type':
            // After typing, just short delay is usually enough
            verification = null;
            break;

        case 'key':
            // Special key handling
            if (args[0]?.toUpperCase() === 'LWIN') {
                // After pressing Windows key, Start should appear
                verification = () => VERIFICATION_STRATEGIES.windowExists('Start');
            }
            break;

        case 'open':
        case 'browse':
            // After opening, window should exist
            if (args[0]) {
                const appName = args[0].split('/').pop().split('\\').pop().replace('.exe', '');
                verification = () => VERIFICATION_STRATEGIES.windowExists(appName);
            }
            break;

        case 'kill':
            // After kill, window should be gone
            if (args[0]) {
                verification = () => VERIFICATION_STRATEGIES.windowClosed(args[0]);
            }
            break;
    }

    return executeWithVerification(action, verification);
}

/**
 * Execute sequence of actions with course correction
 */
export async function executeSequence(actions, options = {}) {
    const results = [];
    const stopOnError = options.stopOnError !== false;

    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        console.log(`Step ${i + 1}/${actions.length}: ${action.command} ${action.args?.join(' ') || ''}`);

        const result = await smartExecute(action);
        results.push({
            step: i + 1,
            action: action,
            ...result
        });

        if (!result.success && stopOnError) {
            console.log(`Sequence stopped at step ${i + 1} due to failure`);
            break;
        }

        // Small delay between actions
        await sleep(200);
    }

    const allSuccess = results.every(r => r.success);
    return {
        success: allSuccess,
        results: results,
        completedSteps: results.filter(r => r.success).length,
        totalSteps: actions.length
    };
}

/**
 * Recovery actions for common failure scenarios
 */
export const RECOVERY_ACTIONS = {
    /**
     * Try to close any blocking dialogs
     */
    dismissDialogs: async () => {
        await executeAction('key', ['ESC']);
        await sleep(200);
        await executeAction('key', ['ENTER']);
    },

    /**
     * Click away from current focus
     */
    clickAway: async () => {
        await executeAction('mouse', ['100', '100']);
        await executeAction('click');
    },

    /**
     * Force focus to desktop
     */
    focusDesktop: async () => {
        await executeAction('hotkey', ['LWIN+D']);
    },

    /**
     * Close active window
     */
    closeActiveWindow: async () => {
        await executeAction('hotkey', ['ALT+F4']);
    }
};

// Utility
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
    executeWithVerification,
    smartExecute,
    executeSequence,
    VERIFICATION_STRATEGIES,
    RECOVERY_ACTIONS
};
