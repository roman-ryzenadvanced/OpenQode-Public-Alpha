/**
 * Icon System with ASCII Fallbacks
 * Provides consistent icons across all terminal capabilities
 * Uses Unicode when safe, ASCII otherwise
 */

import { isUnicodeOK, getProfile, PROFILE } from './terminal-profile.mjs';

// Icon definitions: [Unicode, ASCII fallback]
const ICON_DEFS = {
    // Roles
    user: ['👤', '>'],
    assistant: ['🤖', '*'],
    system: ['⚙️', '#'],
    tool: ['🔧', '@'],
    error: ['❌', 'X'],
    success: ['✓', '+'],
    warning: ['⚠️', '!'],
    info: ['ℹ️', 'i'],

    // Status
    thinking: ['💭', '...'],
    running: ['▶', '>'],
    done: ['✓', '+'],
    failed: ['✗', 'X'],
    waiting: ['⏳', '~'],

    // UI Elements
    folder: ['📁', '[D]'],
    file: ['📄', '[F]'],
    branch: ['⎇', '@'],
    model: ['🧠', 'M:'],
    project: ['📦', 'P:'],
    rooted: ['✓', '+'],

    // Actions
    copy: ['📋', 'C'],
    save: ['💾', 'S'],
    apply: ['✓', '+'],
    cancel: ['✗', 'X'],
    expand: ['▼', 'v'],
    collapse: ['▲', '^'],
    new_output: ['↓', 'v'],

    // Decorators
    live: ['⚡', '*'],
    spinner: ['◐', '-'],
    bullet: ['•', '-'],
    arrow_right: ['→', '>'],
    arrow_down: ['↓', 'v'],

    // Rail markers
    rail_user: ['│', '|'],
    rail_assistant: ['│', '|'],
    rail_system: ['│', '|'],
    rail_tool: ['│', '|'],
    rail_error: ['│', '|'],

    // Borders (Unicode box drawing vs ASCII)
    border_h: ['─', '-'],
    border_v: ['│', '|'],
    corner_tl: ['┌', '+'],
    corner_tr: ['┐', '+'],
    corner_bl: ['└', '+'],
    corner_br: ['┘', '+'],
    tee_l: ['├', '+'],
    tee_r: ['┤', '+'],
    tee_t: ['┬', '+'],
    tee_b: ['┴', '+'],
    cross: ['┼', '+'],

    // Progress
    progress_fill: ['█', '#'],
    progress_empty: ['░', '.'],
    progress_half: ['▒', ':'],

    // Checkbox
    checkbox_empty: ['[ ]', '[ ]'],
    checkbox_checked: ['[✓]', '[x]'],
    checkbox_current: ['[→]', '[>]']
};

/**
 * Get an icon by name, respecting terminal capabilities
 * @param {string} name - Icon name from ICON_DEFS
 * @param {boolean} forceAscii - Force ASCII even if Unicode is available
 * @returns {string} The icon character
 */
export function icon(name, forceAscii = false) {
    const def = ICON_DEFS[name];
    if (!def) return '?';

    const useAscii = forceAscii || !isUnicodeOK() || getProfile() === PROFILE.SAFE_ASCII;
    return useAscii ? def[1] : def[0];
}

/**
 * Get border character by name
 */
export function border(name) {
    return icon(`border_${name}`) || icon(name);
}

/**
 * Get a role icon
 */
export function roleIcon(role) {
    return icon(role) || icon('info');
}

/**
 * Get a status icon
 */
export function statusIcon(status) {
    return icon(status) || icon('info');
}

/**
 * Build a simple ASCII progress bar
 * @param {number} progress - 0-1 value
 * @param {number} width - Character width
 */
export function progressBar(progress, width = 10) {
    const filled = Math.round(progress * width);
    const empty = width - filled;
    return icon('progress_fill').repeat(filled) + icon('progress_empty').repeat(empty);
}

/**
 * Get checkbox icon by state
 */
export function checkbox(state) {
    if (state === 'current') return icon('checkbox_current');
    if (state === true || state === 'checked') return icon('checkbox_checked');
    return icon('checkbox_empty');
}

// Export all icon definitions for reference
export const ICONS = ICON_DEFS;

export default {
    icon,
    border,
    roleIcon,
    statusIcon,
    progressBar,
    checkbox,
    ICONS
};
