/**
 * Terminal Profile Detection
 * Detects terminal capabilities and returns one of three rendering profiles:
 * - SAFE_ASCII: PowerShell/legacy-safe (ASCII borders, 16-color, no backgrounds)
 * - ANSI_256: 256-color, conservative backgrounds
 * - TRUECOLOR_UNICODE: Full Unicode + truecolor when reliable
 */

// Rendering profile constants
export const PROFILE = {
    SAFE_ASCII: 'SAFE_ASCII',
    ANSI_256: 'ANSI_256',
    TRUECOLOR_UNICODE: 'TRUECOLOR_UNICODE'
};

/**
 * Detect terminal capabilities
 * Returns { profile, unicodeOK, truecolorOK, backgroundOK, dimOK }
 */
export function detectCapabilities() {
    const env = process.env;
    const term = env.TERM || '';
    const colorterm = env.COLORTERM || '';
    const termProgram = env.TERM_PROGRAM || '';
    const wtSession = env.WT_SESSION; // Windows Terminal
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    // Detect truecolor support
    const truecolorOK = (
        colorterm === 'truecolor' ||
        colorterm === '24bit' ||
        termProgram === 'iTerm.app' ||
        termProgram === 'Hyper' ||
        term.includes('256color') ||
        wtSession !== undefined // Windows Terminal supports truecolor
    );

    // Detect Unicode support
    const unicodeOK = (
        !isWindows || // Unix terminals generally support Unicode
        wtSession !== undefined || // Windows Terminal
        termProgram === 'vscode' || // VS Code integrated terminal
        env.LANG?.includes('UTF-8') ||
        env.LC_ALL?.includes('UTF-8')
    );

    // Detect 256-color support
    const color256OK = (
        term.includes('256color') ||
        truecolorOK ||
        wtSession !== undefined
    );

    // Background colors work reliably in most modern terminals
    const backgroundOK = truecolorOK || color256OK || isMac;

    // Dim text support (not reliable in all terminals)
    const dimOK = !isWindows || wtSession !== undefined || termProgram === 'vscode';

    // Determine profile
    let profile;
    if (truecolorOK && unicodeOK) {
        profile = PROFILE.TRUECOLOR_UNICODE;
    } else if (color256OK) {
        profile = PROFILE.ANSI_256;
    } else {
        profile = PROFILE.SAFE_ASCII;
    }

    return {
        profile,
        unicodeOK,
        truecolorOK,
        color256OK,
        backgroundOK,
        dimOK,
        isWindows,
        isMac,
        termProgram,
        wtSession: !!wtSession
    };
}

// Cache the detection result
let _cachedCapabilities = null;

/**
 * Get cached terminal capabilities (call once at startup)
 */
export function getCapabilities() {
    if (!_cachedCapabilities) {
        _cachedCapabilities = detectCapabilities();
    }
    return _cachedCapabilities;
}

/**
 * Get current rendering profile
 */
export function getProfile() {
    return getCapabilities().profile;
}

/**
 * Check if Unicode is safe to use
 */
export function isUnicodeOK() {
    return getCapabilities().unicodeOK;
}

/**
 * Check if backgrounds are safe to use
 */
export function isBackgroundOK() {
    return getCapabilities().backgroundOK;
}

/**
 * Check if dim text is safe
 */
export function isDimOK() {
    return getCapabilities().dimOK;
}

export default {
    PROFILE,
    detectCapabilities,
    getCapabilities,
    getProfile,
    isUnicodeOK,
    isBackgroundOK,
    isDimOK
};
