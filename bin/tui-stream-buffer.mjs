/**
 * Streaming Buffer Hook for OpenQode TUI
 * 
 * ANTI-JITTER SYSTEM:
 * 1. Buffer incoming tokens (no per-token React updates)
 * 2. Flush on stable boundaries: newline, punctuation (.!?), or timeout
 * 3. Freeze layout during streaming (no mid-word reflow)
 * 4. Debounce resize events
 * 5. Memoize heavy transforms per committed content
 */

import { useState, useRef, useCallback, useMemo } from 'react';

// Hard boundary that triggers an immediate flush.
// Newlines are stable layout boundaries and reduce mid-line jitter.
const FLUSH_HARD_BOUNDARY = /\n/;

// Soft boundary flush: when pending grows large and we hit whitespace.
const SOFT_BOUNDARY = /\s/;
const MIN_PENDING_BEFORE_SOFT_FLUSH = 140;

/**
 * useStreamBuffer - Stable streaming text buffer
 * 
 * Instead of re-rendering on every token, this hook:
 * - Accumulates tokens in a pending buffer
 * - Commits on sentence boundaries (newline, punctuation) or timeout
 * - Prevents mid-word reflows and jitter
 * 
 * @param {number} flushInterval - Max ms before forced flush (default 100ms)
 * @returns {Object} { committed, pending, isStreaming, pushToken, flushNow, reset }
 */
export function useStreamBuffer(flushInterval = 150) {
    const [committed, setCommitted] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const pendingRef = useRef('');
    const flushTimerRef = useRef(null);
    const lastActivityRef = useRef(0);

    // Push a token to the pending buffer
    const pushToken = useCallback((token) => {
        pendingRef.current += token;
        lastActivityRef.current = Date.now();

        if (!isStreaming) {
            setIsStreaming(true);
        }

        // Flush immediately on hard boundary (newline)
        if (FLUSH_HARD_BOUNDARY.test(token)) {
            if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
            setCommitted(prev => prev + pendingRef.current);
            pendingRef.current = '';
            return;
        }

        // Flush on "soft" boundary to reduce reflow (avoid mid-word updates).
        if (pendingRef.current.length >= MIN_PENDING_BEFORE_SOFT_FLUSH && SOFT_BOUNDARY.test(token)) {
            if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
            setCommitted(prev => prev + pendingRef.current);
            pendingRef.current = '';
            return;
        }

        // Schedule flush if not already pending
        if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
                setCommitted(prev => prev + pendingRef.current);
                pendingRef.current = '';
                flushTimerRef.current = null;
            }, flushInterval);
        }
    }, [flushInterval, isStreaming]);

    // Force immediate flush
    const flushNow = useCallback(() => {
        if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
        }
        if (pendingRef.current) {
            setCommitted(prev => prev + pendingRef.current);
            pendingRef.current = '';
        }
        setIsStreaming(false);
    }, []);

    // Reset buffer (for new messages)
    const reset = useCallback(() => {
        if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
        }
        pendingRef.current = '';
        setCommitted('');
        setIsStreaming(false);
        lastActivityRef.current = 0;
    }, []);

    // Get current total (committed + pending, for display during active streaming)
    const getTotal = useCallback(() => {
        return committed + pendingRef.current;
    }, [committed]);

    // Check if actively streaming (had activity in last 500ms)
    const isActivelyStreaming = useCallback(() => {
        return Date.now() - lastActivityRef.current < 500;
    }, []);

    return {
        committed,
        pending: pendingRef.current,
        isStreaming,
        pushToken,
        flushNow,
        reset,
        getTotal,
        isActivelyStreaming,
        isPending: pendingRef.current.length > 0
    };
}

/**
 * useFrozenLayout - Freeze layout dimensions during streaming
 * Prevents "breathing" text and layout shifts
 */
export function useFrozenLayout(isStreaming, currentWidth) {
    const frozenWidthRef = useRef(null);

    // Freeze width when streaming starts
    if (isStreaming && frozenWidthRef.current === null) {
        frozenWidthRef.current = currentWidth;
    }

    // Unfreeze when streaming stops
    if (!isStreaming) {
        frozenWidthRef.current = null;
    }

    // Return frozen width during streaming, live width otherwise
    return frozenWidthRef.current ?? currentWidth;
}

/**
 * Resize debounce hook
 * Only reflows content after terminal resize settles
 */
export function useResizeDebounce(callback, delay = 200) {
    const timerRef = useRef(null);

    return useCallback((cols, rows) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
            callback(cols, rows);
            timerRef.current = null;
        }, delay);
    }, [callback, delay]);
}

/**
 * useMemoizedParse - Memoize parsed content per committed text
 * Prevents re-parsing on every render
 */
export function useMemoizedParse(committed, parseFn) {
    return useMemo(() => {
        if (!committed) return null;
        return parseFn(committed);
    }, [committed]);
}

/**
 * Autoscroll control
 * Only follow output if user is at bottom
 */
export function useAutoscroll(messageCount, viewportTop, viewportHeight, totalHeight) {
    const wasAtBottomRef = useRef(true);
    const newOutputCountRef = useRef(0);

    // Check if user is at bottom
    const isAtBottom = viewportTop + viewportHeight >= totalHeight - 1;

    // Track new output when not at bottom
    if (!isAtBottom && messageCount > 0) {
        newOutputCountRef.current++;
    } else {
        newOutputCountRef.current = 0;
    }

    wasAtBottomRef.current = isAtBottom;

    return {
        shouldScroll: isAtBottom,
        newOutputCount: newOutputCountRef.current,
        isAtBottom
    };
}

export default {
    useStreamBuffer,
    useFrozenLayout,
    useResizeDebounce,
    useMemoizedParse,
    useAutoscroll
};
