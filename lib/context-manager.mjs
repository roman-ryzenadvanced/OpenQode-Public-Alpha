/**
 * Context Manager - Intelligent context window management for TUI 5
 * Auto-summarizes conversation history when approaching token limits
 * 
 * Original implementation for OpenQode TUI
 */

import { getQwen } from '../qwen-oauth.mjs';

// Rough token estimation: ~4 chars per token for English
const CHARS_PER_TOKEN = 4;

/**
 * ContextManager class - Manages conversation context and auto-summarization
 */
export class ContextManager {
    constructor(options = {}) {
        this.tokenLimit = options.tokenLimit || 100000; // Default 100K token context
        this.summarizeThreshold = options.summarizeThreshold || 0.5; // Summarize at 50%
        this.minMessagesToKeep = options.minMessagesToKeep || 4; // Keep last 4 messages
        this.summaryBlock = null; // Stores summarized context
    }

    /**
     * Estimate token count for text
     * @param {string} text - Text to count
     * @returns {number} Estimated token count
     */
    countTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / CHARS_PER_TOKEN);
    }

    /**
     * Count tokens for all messages
     * @param {Array} messages - Array of message objects
     * @returns {number} Total estimated tokens
     */
    countMessageTokens(messages) {
        return messages.reduce((total, msg) => {
            return total + this.countTokens(msg.content || '');
        }, 0);
    }

    /**
     * Get current context usage as percentage
     * @param {Array} messages - Current messages
     * @returns {number} Percentage (0-100)
     */
    getUsagePercent(messages) {
        const used = this.countMessageTokens(messages);
        return Math.round((used / this.tokenLimit) * 100);
    }

    /**
     * Check if summarization is needed
     * @param {Array} messages - Current messages
     * @returns {boolean}
     */
    shouldSummarize(messages) {
        const usage = this.getUsagePercent(messages) / 100;
        return usage >= this.summarizeThreshold && messages.length > this.minMessagesToKeep;
    }

    /**
     * Summarize older messages to free up context
     * @param {Array} messages - All messages
     * @param {Function} onProgress - Progress callback
     * @returns {Object} { summary, keptMessages }
     */
    async summarize(messages, onProgress = null) {
        if (messages.length <= this.minMessagesToKeep) {
            return { summary: null, keptMessages: messages };
        }

        // Split: messages to summarize vs messages to keep
        const toSummarize = messages.slice(0, -this.minMessagesToKeep);
        const toKeep = messages.slice(-this.minMessagesToKeep);

        if (onProgress) onProgress('Summarizing context...');

        // Create summary prompt
        const summaryPrompt = `Summarize the following conversation history into a concise context summary. 
Focus on:
- Key decisions made
- Important context established
- User preferences expressed
- Current project/task state

Keep it under 500 words.

CONVERSATION TO SUMMARIZE:
${toSummarize.map(m => `[${m.role}]: ${m.content}`).join('\n\n')}

SUMMARY:`;

        try {
            // Use AI to generate summary
            const oauth = getQwen();
            const result = await oauth.sendMessage(summaryPrompt, 'qwen-turbo');

            if (result.success) {
                this.summaryBlock = {
                    type: 'context_summary',
                    content: result.response,
                    originalMessageCount: toSummarize.length,
                    timestamp: new Date().toISOString()
                };

                return {
                    summary: this.summaryBlock,
                    keptMessages: toKeep
                };
            }
        } catch (error) {
            console.error('Context summarization failed:', error.message);
        }

        // Fallback: simple truncation
        this.summaryBlock = {
            type: 'context_truncated',
            content: `[Previous ${toSummarize.length} messages truncated to save context]`,
            originalMessageCount: toSummarize.length,
            timestamp: new Date().toISOString()
        };

        return {
            summary: this.summaryBlock,
            keptMessages: toKeep
        };
    }

    /**
     * Get context summary as system prompt addition
     */
    getSummaryContext() {
        if (!this.summaryBlock) return '';

        return `
=== PREVIOUS CONTEXT SUMMARY ===
The following is a summary of earlier conversation (${this.summaryBlock.originalMessageCount} messages):

${this.summaryBlock.content}

=== END SUMMARY ===

`;
    }

    /**
     * Get stats for UI display
     * @param {Array} messages - Current messages
     * @returns {Object} Stats object
     */
    getStats(messages) {
        const tokens = this.countMessageTokens(messages);
        const percent = this.getUsagePercent(messages);
        const needsSummary = this.shouldSummarize(messages);

        return {
            tokens,
            limit: this.tokenLimit,
            percent,
            needsSummary,
            hasSummary: !!this.summaryBlock,
            color: percent > 80 ? 'red' : percent > 50 ? 'yellow' : 'green'
        };
    }
}

// Singleton instance
let _contextManager = null;

export function getContextManager(options = {}) {
    if (!_contextManager) {
        _contextManager = new ContextManager(options);
    }
    return _contextManager;
}

export default ContextManager;
