/**
 * Debug Logger - Comprehensive request/response logging for TUI 5
 * Enabled via --debug flag or /debug command
 * 
 * Original implementation for OpenQode TUI
 */

import { appendFile, writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';

const DEBUG_FILE = '.openqode-debug.log';

/**
 * DebugLogger class - Logs all API requests, responses, and tool executions
 */
export class DebugLogger {
    constructor(options = {}) {
        this.enabled = options.enabled || false;
        this.logPath = options.logPath || join(process.cwd(), DEBUG_FILE);
        this.maxLogSize = options.maxLogSize || 5 * 1024 * 1024; // 5MB max
        this.sessionId = Date.now().toString(36);
    }

    /**
     * Enable debug logging
     */
    enable() {
        this.enabled = true;
        this.log('DEBUG', 'Debug logging enabled');
    }

    /**
     * Disable debug logging
     */
    disable() {
        this.log('DEBUG', 'Debug logging disabled');
        this.enabled = false;
    }

    /**
     * Toggle debug mode
     */
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.enabled;
    }

    /**
     * Format timestamp
     */
    timestamp() {
        return new Date().toISOString();
    }

    /**
     * Log a message
     * @param {string} level - Log level (INFO, DEBUG, WARN, ERROR, API, TOOL)
     * @param {string} message - Log message
     * @param {Object} data - Optional data to log
     */
    async log(level, message, data = null) {
        if (!this.enabled && level !== 'DEBUG') return;

        const entry = {
            timestamp: this.timestamp(),
            session: this.sessionId,
            level,
            message,
            ...(data && { data: this.truncate(data) })
        };

        const logLine = JSON.stringify(entry) + '\n';

        try {
            await appendFile(this.logPath, logLine);
        } catch (error) {
            // Silent fail - debug logging shouldn't break the app
        }
    }

    /**
     * Log API request
     */
    async logRequest(provider, model, prompt, options = {}) {
        await this.log('API_REQUEST', `${provider}/${model}`, {
            promptLength: prompt?.length || 0,
            promptPreview: prompt?.substring(0, 200) + '...',
            options
        });
    }

    /**
     * Log API response
     */
    async logResponse(provider, model, response, duration) {
        await this.log('API_RESPONSE', `${provider}/${model}`, {
            success: response?.success,
            responseLength: response?.response?.length || 0,
            responsePreview: response?.response?.substring(0, 200) + '...',
            durationMs: duration,
            usage: response?.usage
        });
    }

    /**
     * Log tool execution
     */
    async logTool(toolName, input, output, duration) {
        await this.log('TOOL', toolName, {
            input: this.truncate(input),
            output: this.truncate(output),
            durationMs: duration
        });
    }

    /**
     * Log error
     */
    async logError(context, error) {
        await this.log('ERROR', context, {
            message: error?.message,
            stack: error?.stack?.substring(0, 500)
        });
    }

    /**
     * Log user command
     */
    async logCommand(command, args) {
        await this.log('COMMAND', command, { args });
    }

    /**
     * Truncate large objects for logging
     */
    truncate(obj, maxLength = 1000) {
        if (!obj) return obj;

        if (typeof obj === 'string') {
            return obj.length > maxLength
                ? obj.substring(0, maxLength) + '...[truncated]'
                : obj;
        }

        try {
            const str = JSON.stringify(obj);
            if (str.length > maxLength) {
                return JSON.parse(str.substring(0, maxLength) + '..."}}');
            }
            return obj;
        } catch {
            return '[Object]';
        }
    }

    /**
     * Clear log file
     */
    async clear() {
        try {
            await writeFile(this.logPath, '');
            await this.log('DEBUG', 'Log file cleared');
        } catch (error) {
            // Ignore
        }
    }

    /**
     * Get recent log entries
     * @param {number} count - Number of entries to return
     */
    async getRecent(count = 50) {
        try {
            const content = await readFile(this.logPath, 'utf8');
            const lines = content.trim().split('\n').filter(l => l);
            return lines.slice(-count).map(l => {
                try {
                    return JSON.parse(l);
                } catch {
                    return { raw: l };
                }
            });
        } catch {
            return [];
        }
    }

    /**
     * Get log file path
     */
    getPath() {
        return this.logPath;
    }
}

// Singleton instance
let _logger = null;

export function getDebugLogger(options = {}) {
    if (!_logger) {
        _logger = new DebugLogger(options);
    }
    return _logger;
}

// Check CLI args for --debug flag
export function initFromArgs() {
    const logger = getDebugLogger();
    if (process.argv.includes('--debug')) {
        logger.enable();
    }
    return logger;
}

export default DebugLogger;
