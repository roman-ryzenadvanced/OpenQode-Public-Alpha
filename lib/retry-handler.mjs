/**
 * Enhanced Retry & Timeout Handler
 * Based on: Mini-Agent retry.py
 * 
 * Features:
 * - Exponential backoff strategy
 * - Configurable max retries and delays
 * - Visual callback for retry UI
 * - Timeout handling with graceful recovery
 */

/**
 * Retry configuration class
 */
export class RetryConfig {
    constructor(options = {}) {
        this.enabled = options.enabled ?? true;
        this.maxRetries = options.maxRetries ?? 3;
        this.initialDelay = options.initialDelay ?? 1000; // ms
        this.maxDelay = options.maxDelay ?? 60000; // ms  
        this.exponentialBase = options.exponentialBase ?? 2.0;
        this.timeout = options.timeout ?? 120000; // 120s default
        this.retryableErrors = options.retryableErrors ?? [
            'ETIMEDOUT',
            'ECONNRESET',
            'ECONNREFUSED',
            'ENOTFOUND',
            'network',
            'timeout',
            '429', // Rate limit
            '500', // Server error
            '502', // Bad gateway
            '503', // Service unavailable
            '504'  // Gateway timeout
        ];
    }

    /**
     * Calculate delay time using exponential backoff
     * @param {number} attempt - Current attempt (0-indexed)
     * @returns {number} Delay in milliseconds
     */
    calculateDelay(attempt) {
        const delay = this.initialDelay * Math.pow(this.exponentialBase, attempt);
        return Math.min(delay, this.maxDelay);
    }

    /**
     * Check if error is retryable
     */
    isRetryable(error) {
        const errorString = String(error?.code || error?.message || error).toLowerCase();
        return this.retryableErrors.some(code =>
            errorString.includes(String(code).toLowerCase())
        );
    }
}

/**
 * Create a retry wrapper for async functions
 * @param {Function} fn - Async function to wrap
 * @param {RetryConfig} config - Retry configuration
 * @param {Function} onRetry - Callback on each retry (error, attempt, delay)
 * @returns {Function} Wrapped function with retry logic
 */
export function withRetry(fn, config = new RetryConfig(), onRetry = null) {
    return async function (...args) {
        let lastError = null;

        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                // Create abort controller for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), config.timeout);

                try {
                    // Pass abort signal if function accepts it
                    const result = await fn(...args, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    return result;
                } finally {
                    clearTimeout(timeoutId);
                }
            } catch (error) {
                lastError = error;

                // Check if we should retry
                const isTimeout = error.name === 'AbortError' ||
                    error.message?.includes('timed out');
                const isRetryable = config.isRetryable(error) || isTimeout;

                if (!isRetryable || attempt >= config.maxRetries) {
                    throw new RetryExhaustedError(lastError, attempt + 1);
                }

                // Calculate delay
                const delay = config.calculateDelay(attempt);

                // Call retry callback for UI updates
                if (onRetry) {
                    onRetry(error, attempt + 1, delay);
                }

                // Wait before retry
                await sleep(delay);
            }
        }

        throw lastError;
    };
}

/**
 * Retry exhausted error
 */
export class RetryExhaustedError extends Error {
    constructor(lastException, attempts) {
        super(`Retry failed after ${attempts} attempts. Last error: ${lastException?.message || lastException}`);
        this.name = 'RetryExhaustedError';
        this.lastException = lastException;
        this.attempts = attempts;
    }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format retry status for display
 * @param {number} attempt - Current attempt number
 * @param {number} maxRetries - Maximum retries
 * @param {number} delay - Delay in ms before next retry
 * @returns {string} Formatted status string
 */
export function formatRetryStatus(attempt, maxRetries, delay) {
    const delaySeconds = (delay / 1000).toFixed(1);
    return `⟳ Retry ${attempt}/${maxRetries} in ${delaySeconds}s...`;
}

/**
 * Format timeout message
 * @param {number} timeoutMs - Timeout in milliseconds  
 * @returns {string} Formatted timeout message
 */
export function formatTimeoutMessage(timeoutMs) {
    const seconds = Math.round(timeoutMs / 1000);
    return `⏱ Request timed out (${seconds}s)`;
}

/**
 * Create progress callback for retry UI
 * @param {Function} setStatus - State setter for status message
 * @returns {Function} Callback function for withRetry
 */
export function createRetryCallback(setStatus) {
    return (error, attempt, delay) => {
        const seconds = (delay / 1000).toFixed(1);
        const errorMsg = error.message || 'Connection error';
        setStatus({
            type: 'retry',
            attempt,
            delay: seconds,
            message: `⟳ ${errorMsg} - Retrying in ${seconds}s... (${attempt}/3)`
        });
    };
}

/**
 * Enhanced fetch with built-in retry and timeout
 */
export async function fetchWithRetry(url, options = {}, config = new RetryConfig()) {
    const fetchFn = async (fetchUrl, fetchOptions, { signal }) => {
        const response = await fetch(fetchUrl, {
            ...fetchOptions,
            signal
        });

        if (!response.ok && config.retryableErrors.includes(String(response.status))) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
    };

    return withRetry(fetchFn, config)(url, options);
}

/**
 * Default export
 */
export default {
    RetryConfig,
    RetryExhaustedError,
    withRetry,
    sleep,
    formatRetryStatus,
    formatTimeoutMessage,
    createRetryCallback,
    fetchWithRetry
};
