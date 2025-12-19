/**
 * Responsive Layout Module for OpenQode TUI
 * 
 * PREMIUM LAYOUT RULES:
 * 1. Deterministic grid: Sidebar (fixed) | Divider (1) | Main (flex)
 * 2. Integer widths ONLY (no floating point)
 * 3. Golden breakpoints: 60/80/100/120+ cols verified
 * 4. No bordered element with flexGrow (causes stray lines)
 * 5. One divider between sidebar and main (never ||)
 * 
 * Breakpoints:
 * - Tiny: cols < 60 (no sidebar, minimal chrome)
 * - Narrow: 60 <= cols < 80 (sidebar collapsed by default)
 * - Medium: 80 <= cols < 100 (compact sidebar)
 * - Wide: cols >= 100 (full sidebar)
 */

import stringWidth from 'string-width';
import cliTruncate from 'cli-truncate';

// ═══════════════════════════════════════════════════════════════
// GOLDEN BREAKPOINTS (verified layouts)
// ═══════════════════════════════════════════════════════════════
export const BREAKPOINTS = {
    TINY: 60,
    NARROW: 80,
    MEDIUM: 100,
    WIDE: 120
};

// ═══════════════════════════════════════════════════════════════
// FIXED LAYOUT DIMENSIONS (integers only)
// ═══════════════════════════════════════════════════════════════
export const FIXED = {
    // Divider between sidebar and main
    DIVIDER_WIDTH: 1,

    // Outer frame borders
    FRAME_LEFT: 1,
    FRAME_RIGHT: 1,

    // Sidebar widths per breakpoint
    SIDEBAR: {
        TINY: 0,
        NARROW: 0,      // Collapsed by default
        NARROW_EXPANDED: 22,
        MEDIUM: 24,
        WIDE: 28
    },

    // Input bar (NEVER changes height)
    INPUT_HEIGHT: 3,

    // Status strip
    STATUS_HEIGHT: 1,

    // Minimum main content width
    MIN_MAIN_WIDTH: 40,

    // Max readable line width (prevent edge-to-edge text)
    MAX_LINE_WIDTH: 90
};

// ═══════════════════════════════════════════════════════════════
// LAYOUT MODE DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Compute layout mode based on terminal dimensions
 * Returns explicit integer widths for all regions
 * 
 * @param {number} cols - Terminal columns
 * @param {number} rows - Terminal rows
 * @returns {Object} Layout configuration with exact pixel widths
 */
export function computeLayoutMode(cols, rows) {
    const c = Math.floor(cols ?? 80);
    const r = Math.floor(rows ?? 24);

    // Tiny mode: very small terminal
    if (c < BREAKPOINTS.TINY || r < 20) {
        return {
            mode: 'tiny',
            cols: c,
            rows: r,
            sidebarWidth: 0,
            dividerWidth: 0,
            mainWidth: c - FIXED.FRAME_LEFT - FIXED.FRAME_RIGHT,
            sidebarCollapsed: true,
            showBorders: false,
            showSidebar: false,
            transcriptHeight: r - FIXED.INPUT_HEIGHT - FIXED.STATUS_HEIGHT - 2
        };
    }

    // Narrow mode: sidebar collapsed by default
    if (c < BREAKPOINTS.NARROW) {
        const mainWidth = c - FIXED.FRAME_LEFT - FIXED.FRAME_RIGHT;
        return {
            mode: 'narrow',
            cols: c,
            rows: r,
            sidebarWidth: 0, // collapsed default
            sidebarExpandedWidth: FIXED.SIDEBAR.NARROW_EXPANDED,
            dividerWidth: 0,
            mainWidth: mainWidth,
            sidebarCollapsedDefault: true,
            showBorders: true,
            showSidebar: false,
            transcriptHeight: r - FIXED.INPUT_HEIGHT - FIXED.STATUS_HEIGHT - 2
        };
    }

    // Medium mode: compact sidebar
    if (c < BREAKPOINTS.WIDE) {
        const sidebarWidth = FIXED.SIDEBAR.MEDIUM;
        const mainWidth = c - sidebarWidth - FIXED.DIVIDER_WIDTH - FIXED.FRAME_LEFT - FIXED.FRAME_RIGHT;
        return {
            mode: 'medium',
            cols: c,
            rows: r,
            sidebarWidth: sidebarWidth,
            dividerWidth: FIXED.DIVIDER_WIDTH,
            mainWidth: Math.max(FIXED.MIN_MAIN_WIDTH, mainWidth),
            sidebarCollapsed: false,
            showBorders: true,
            showSidebar: true,
            transcriptHeight: r - FIXED.INPUT_HEIGHT - FIXED.STATUS_HEIGHT - 2
        };
    }

    // Wide mode: full sidebar
    const sidebarWidth = FIXED.SIDEBAR.WIDE;
    const mainWidth = c - sidebarWidth - FIXED.DIVIDER_WIDTH - FIXED.FRAME_LEFT - FIXED.FRAME_RIGHT;
    return {
        mode: 'wide',
        cols: c,
        rows: r,
        sidebarWidth: sidebarWidth,
        dividerWidth: FIXED.DIVIDER_WIDTH,
        mainWidth: Math.max(FIXED.MIN_MAIN_WIDTH, mainWidth),
        sidebarCollapsed: false,
        showBorders: true,
        showSidebar: true,
        transcriptHeight: r - FIXED.INPUT_HEIGHT - FIXED.STATUS_HEIGHT - 2
    };
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Get sidebar width for current mode and toggle state
 * @param {Object} layout - Layout configuration
 * @param {boolean} isExpanded - Whether sidebar is manually expanded
 * @returns {number} Sidebar width in columns (integer)
 */
export function getSidebarWidth(layout, isExpanded) {
    if (layout.mode === 'tiny') return 0;

    if (layout.mode === 'narrow') {
        return isExpanded ? (layout.sidebarExpandedWidth || FIXED.SIDEBAR.NARROW_EXPANDED) : 0;
    }

    return layout.sidebarWidth;
}

/**
 * Get main content width (with optional sidebar toggle state)
 * @param {Object} layout - Layout configuration
 * @param {number} currentSidebarWidth - Current sidebar width
 * @returns {number} Main content width (integer)
 */
export function getMainWidth(layout, currentSidebarWidth) {
    const divider = currentSidebarWidth > 0 ? FIXED.DIVIDER_WIDTH : 0;
    const available = layout.cols - currentSidebarWidth - divider - FIXED.FRAME_LEFT - FIXED.FRAME_RIGHT;
    return Math.max(FIXED.MIN_MAIN_WIDTH, Math.floor(available));
}

/**
 * Get clamped content width for readable text
 */
export function getContentWidth(mainWidth) {
    return Math.min(mainWidth - 2, FIXED.MAX_LINE_WIDTH);
}

/**
 * Truncate text to fit width (unicode-aware)
 * @param {string} text - Text to truncate
 * @param {number} width - Maximum width
 * @returns {string} Truncated text
 */
export function truncateText(text, width) {
    if (!text) return '';
    return cliTruncate(String(text), width, { position: 'end' });
}

/**
 * Get visual width of text (unicode-aware)
 * @param {string} text - Text to measure
 * @returns {number} Visual width
 */
export function getTextWidth(text) {
    if (!text) return 0;
    return stringWidth(String(text));
}

/**
 * Pad text to specific width
 * @param {string} text - Text to pad
 * @param {number} width - Target width
 * @param {string} char - Padding character
 * @returns {string} Padded text
 */
export function padText(text, width, char = ' ') {
    if (!text) return char.repeat(width);
    const currentWidth = getTextWidth(text);
    if (currentWidth >= width) return truncateText(text, width);
    return text + char.repeat(width - currentWidth);
}

// ═══════════════════════════════════════════════════════════════
// VIEWPORT HEIGHT CALCULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate viewport dimensions for message list
 * @param {Object} layout - Layout configuration
 * @param {Object} options - Additional options
 * @returns {Object} Viewport dimensions
 */
export function calculateViewport(layout, options = {}) {
    const {
        headerRows = 0,
        inputRows = 3,
        thinkingRows = 0,
        marginsRows = 2
    } = options;

    const totalReserved = headerRows + inputRows + thinkingRows + marginsRows;
    const messageViewHeight = Math.max(4, layout.rows - totalReserved);

    // Estimate how many messages fit (conservative: ~4 lines per message avg)
    const linesPerMessage = 4;
    const maxVisibleMessages = Math.max(2, Math.floor(messageViewHeight / linesPerMessage));

    return {
        viewHeight: messageViewHeight,
        maxMessages: maxVisibleMessages,
        inputRows,
        headerRows
    };
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const LAYOUT_CONSTANTS = {
    // Minimum dimensions
    MIN_SIDEBAR_WIDTH: 20,
    MIN_MAIN_WIDTH: 40,
    MIN_MESSAGE_VIEW_HEIGHT: 4,

    // Default padding
    DEFAULT_PADDING_X: 1,
    DEFAULT_PADDING_Y: 0,

    // Message estimation
    LINES_PER_MESSAGE: 4,

    // Input area
    INPUT_BOX_HEIGHT: 3,
    INPUT_BORDER_HEIGHT: 2
};

export default {
    computeLayoutMode,
    getSidebarWidth,
    getMainWidth,
    truncateText,
    getTextWidth,
    padText,
    calculateViewport,
    LAYOUT_CONSTANTS
};
