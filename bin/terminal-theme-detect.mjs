/**
 * Terminal Theme Detection - OSC 11 Query
 * 
 * Based on sst/opencode terminal detection
 * Credit: https://github.com/sst/opencode
 * Credit: https://github.com/MiniMax-AI/Mini-Agent (width utils)
 * 
 * Probes terminal for dark/light mode using OSC 11
 */

import { getCapabilities } from './terminal-profile.mjs';

// Theme modes
export const THEME_MODES = {
    DARK: 'dark',
    LIGHT: 'light',
    AUTO: 'auto'
};

// Cached result
let cachedThemeMode = null;

/**
 * Parse RGB from OSC 11 response
 * Response format: ESC ] 11 ; rgb:RRRR/GGGG/BBBB ESC \
 */
function parseOSC11Response(response) {
    // Match rgb:RRRR/GGGG/BBBB pattern
    const match = response.match(/rgb:([0-9a-f]{4})\/([0-9a-f]{4})\/([0-9a-f]{4})/i);
    if (!match) return null;

    // Convert to 0-255 range
    const r = parseInt(match[1], 16) >> 8;
    const g = parseInt(match[2], 16) >> 8;
    const b = parseInt(match[3], 16) >> 8;

    return { r, g, b };
}

/**
 * Calculate perceived brightness (0-255)
 * Using sRGB luminance formula
 */
function calculateBrightness(rgb) {
    if (!rgb) return 128; // default to middle
    return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

/**
 * Query terminal background color via OSC 11
 * Returns promise that resolves to 'dark' or 'light'
 * 
 * Note: This is async and may timeout on some terminals
 */
export async function queryTerminalBackground(timeoutMs = 500) {
    // Return cached result if available
    if (cachedThemeMode) return cachedThemeMode;

    // Skip if not a TTY
    if (!process.stdout.isTTY) {
        cachedThemeMode = THEME_MODES.DARK;
        return cachedThemeMode;
    }

    // Skip on Windows PowerShell (doesn't support OSC 11)
    const caps = getCapabilities();
    if (caps.profile === 'SAFE_ASCII') {
        cachedThemeMode = THEME_MODES.DARK;
        return cachedThemeMode;
    }

    return new Promise((resolve) => {
        let response = '';
        let timeoutId;

        const cleanup = () => {
            clearTimeout(timeoutId);
            process.stdin.setRawMode?.(false);
            process.stdin.removeListener('data', onData);
        };

        const onData = (data) => {
            response += data.toString();

            // Check for OSC response end (BEL or ST)
            if (response.includes('\x07') || response.includes('\x1b\\')) {
                cleanup();

                const rgb = parseOSC11Response(response);
                const brightness = calculateBrightness(rgb);

                // Threshold: < 128 = dark, >= 128 = light
                cachedThemeMode = brightness < 128 ? THEME_MODES.DARK : THEME_MODES.LIGHT;
                resolve(cachedThemeMode);
            }
        };

        // Set timeout
        timeoutId = setTimeout(() => {
            cleanup();
            // Default to dark on timeout
            cachedThemeMode = THEME_MODES.DARK;
            resolve(cachedThemeMode);
        }, timeoutMs);

        try {
            // Enable raw mode to capture response
            process.stdin.setRawMode?.(true);
            process.stdin.resume();
            process.stdin.on('data', onData);

            // Send OSC 11 query: ESC ] 11 ; ? ESC \
            process.stdout.write('\x1b]11;?\x1b\\');
        } catch (e) {
            cleanup();
            cachedThemeMode = THEME_MODES.DARK;
            resolve(cachedThemeMode);
        }
    });
}

/**
 * Get current theme mode (sync, returns cached or default)
 */
export function getThemeMode() {
    return cachedThemeMode || THEME_MODES.DARK;
}

/**
 * Set theme mode manually
 */
export function setThemeMode(mode) {
    if (Object.values(THEME_MODES).includes(mode)) {
        cachedThemeMode = mode;
    }
}

/**
 * Initialize theme detection
 * Call this at app startup
 */
export async function initThemeDetection() {
    try {
        await queryTerminalBackground();
    } catch (e) {
        cachedThemeMode = THEME_MODES.DARK;
    }
    return cachedThemeMode;
}

export default {
    THEME_MODES,
    queryTerminalBackground,
    getThemeMode,
    setThemeMode,
    initThemeDetection
};
