/**
 * TUI Theme Module - Premium Design System
 * Provides consistent semantic colors, spacing, and rail styling
 * With profile-gated backgrounds for cross-platform compatibility
 * 
 * DESIGN PRINCIPLES:
 * 1. Single accent color (no neon chaos)
 * 2. Semantic roles (fg, muted, accent, border, success/warn/error)
 * 3. Profile-gated backgrounds (SAFE_ASCII avoids most backgrounds)
 * 4. One-frame rule (only outer container has border)
 */

import { getCapabilities, PROFILE, isBackgroundOK, isDimOK, isUnicodeOK } from './terminal-profile.mjs';

// ═══════════════════════════════════════════════════════════════
// SEMANTIC COLOR TOKENS
// ═══════════════════════════════════════════════════════════════
export const colors = {
    // Primary text
    fg: 'white',
    fgBold: 'whiteBright',

    // Muted/secondary text
    muted: 'gray',
    mutedDim: 'gray', // isDimOK() ? dimmed gray : regular gray

    // Single accent (not multi-color chaos)
    accent: 'cyan',
    accentBold: 'cyanBright',

    // Borders and dividers
    border: 'gray',
    borderFocus: 'cyan',
    divider: 'gray',

    // Semantic status colors
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',

    // Role-specific rail colors (left rail indicator)
    rail: {
        user: 'cyan',
        assistant: 'green',
        system: 'yellow',
        tool: 'magenta',
        error: 'red',
        thinking: 'gray'
    },

    // Focus/selection
    focus: 'cyan',
    selection: 'blue'
};

// ═══════════════════════════════════════════════════════════════
// SPACING SCALE (terminal rows/chars)
// ═══════════════════════════════════════════════════════════════
export const spacing = {
    none: 0,
    xs: 0,
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4
};

// ═══════════════════════════════════════════════════════════════
// TYPOGRAPHY HIERARCHY
// ═══════════════════════════════════════════════════════════════
export const typography = {
    // Section headers (e.g., "PROJECT", "SESSION")
    header: { bold: true, color: colors.fg },

    // Labels (e.g., "Branch:", "Model:")
    label: { color: colors.muted },

    // Values (e.g., "main", "qwen-coder-plus")
    value: { color: colors.fg },

    // Muted metadata
    meta: { color: colors.muted, dimColor: true },

    // Status text
    status: { color: colors.accent },

    // Error text
    error: { color: colors.error, bold: true }
};

// ═══════════════════════════════════════════════════════════════
// BORDER STYLES
// ═══════════════════════════════════════════════════════════════
export function getBorderStyle() {
    return isUnicodeOK() ? 'round' : 'single';
}

export const borders = {
    // Only use for outer app frame
    frame: {
        style: getBorderStyle,
        color: colors.border
    },

    // Inner elements use NO borders - only dividers
    none: null
};

// ═══════════════════════════════════════════════════════════════
// RAIL STYLING (replaces nested boxes)
// ═══════════════════════════════════════════════════════════════
export const rail = {
    width: 2, // Rail column width

    // Characters
    char: {
        active: isUnicodeOK() ? '│' : '|',
        streaming: isUnicodeOK() ? '┃' : '|',
        dimmed: isUnicodeOK() ? '╎' : ':'
    },

    // Colors by role
    colors: {
        user: colors.rail.user,
        assistant: colors.rail.assistant,
        system: colors.rail.system,
        tool: colors.rail.tool,
        error: colors.rail.error,
        thinking: colors.rail.thinking
    }
};

// ═══════════════════════════════════════════════════════════════
// LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════════
export const layout = {
    // Sidebar
    sidebar: {
        minWidth: 20,
        maxWidth: 28,
        defaultWidth: 24
    },

    // Divider between sidebar and main
    divider: {
        width: 1,
        char: isUnicodeOK() ? '│' : '|',
        color: colors.border
    },

    // Transcript (main content)
    transcript: {
        maxLineWidth: 90, // Clamp for readability
        minLineWidth: 40,
        padding: 1
    },

    // Input bar (fixed height)
    inputBar: {
        height: 3, // Fixed - never changes
        borderTop: true
    },

    // Status strip (single line)
    statusStrip: {
        height: 1
    },

    // Fixed row reservations
    reservedRows: {
        statusStrip: 1,
        inputBar: 3,
        frameTop: 1,
        frameBottom: 1
    }
};

// ═══════════════════════════════════════════════════════════════
// BREAKPOINTS
// ═══════════════════════════════════════════════════════════════
export const breakpoints = {
    tiny: 60,   // Hide sidebar
    narrow: 80,  // Minimal sidebar
    medium: 100, // Normal sidebar
    wide: 120    // Full sidebar
};

// ═══════════════════════════════════════════════════════════════
// PROFILE-GATED BACKGROUNDS
// ═══════════════════════════════════════════════════════════════
export function getBackground(purpose) {
    // SAFE_ASCII: avoid backgrounds entirely
    if (!isBackgroundOK()) {
        return undefined;
    }

    const backgrounds = {
        selection: '#1a1a2e', // Dark selection
        focus: '#0d1117',    // Focus highlight
        error: '#2d1f1f',    // Error background
        warning: '#2d2a1f',  // Warning background
        thinking: '#1a1a1a'  // Thinking block
    };

    return backgrounds[purpose];
}

// ═══════════════════════════════════════════════════════════════
// UNIFIED THEME OBJECT (backwards compatible)
// ═══════════════════════════════════════════════════════════════
export const theme = {
    colors,
    spacing,
    typography,
    borders,
    rail,
    layout,
    breakpoints,

    // Helper functions
    getBorderStyle,
    getBackground,

    // Capability checks
    isUnicodeOK,
    isBackgroundOK,
    isDimOK
};

export default theme;
