/**
 * Qwen OAuth2 Device Flow for Goose Ultra
 * 
 * Implements RFC 8628 OAuth 2.0 Device Authorization Grant
 * with PKCE (Proof Key for Code Exchange)
 * 
 * Based on: qwen-code/packages/core/src/qwen/qwenOAuth2.ts
 * License: Apache-2.0 (Qwen)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { shell } from 'electron';

// ===== OAUTH CONFIGURATION =====
const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai';
const QWEN_OAUTH_DEVICE_CODE_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/device/code`;
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;

const QWEN_OAUTH_CLIENT_ID = 'f0304373b74a44d2b584a3fb70ca9e56';
const QWEN_OAUTH_SCOPE = 'openid profile email model.completion';
const QWEN_OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

// ===== PKCE UTILITIES (RFC 7636) =====

/**
 * Generate a random code verifier for PKCE
 * @returns A random string of 43-128 characters
 */
export function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate a code challenge from a code verifier using SHA-256
 * @param {string} codeVerifier 
 * @returns {string}
 */
export function generateCodeChallenge(codeVerifier) {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

/**
 * Generate PKCE code verifier and challenge pair
 */
export function generatePKCEPair() {
    const code_verifier = generateCodeVerifier();
    const code_challenge = generateCodeChallenge(code_verifier);
    return { code_verifier, code_challenge };
}

// ===== HELPERS =====

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function objectToUrlEncoded(data) {
    return Object.keys(data)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
        .join('&');
}

// ===== CANCELLATION =====

let isCancelled = false;

export function cancelAuth() {
    isCancelled = true;
}

// ===== MAIN DEVICE FLOW =====

/**
 * Start the OAuth Device Authorization Flow
 * 
 * @param {Function} onProgress - Callback for progress updates
 * @param {Function} onSuccess - Callback with credentials on success
 * @param {Function} onError - Callback with error message on failure
 */
export async function startDeviceFlow(onProgress, onSuccess, onError) {
    isCancelled = false;

    try {
        // 1. Generate PKCE pair
        const { code_verifier, code_challenge } = generatePKCEPair();
        console.log('[QwenOAuth] Starting device flow with PKCE...');

        // 2. Request device code
        const deviceAuthBody = objectToUrlEncoded({
            client_id: QWEN_OAUTH_CLIENT_ID,
            scope: QWEN_OAUTH_SCOPE,
            code_challenge,
            code_challenge_method: 'S256'
        });

        const deviceAuthResponse = await fetch(QWEN_OAUTH_DEVICE_CODE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'x-request-id': crypto.randomUUID()
            },
            body: deviceAuthBody
        });

        if (!deviceAuthResponse.ok) {
            const errorText = await deviceAuthResponse.text();
            throw new Error(`Device authorization failed: ${deviceAuthResponse.status} - ${errorText}`);
        }

        const deviceAuth = await deviceAuthResponse.json();
        console.log('[QwenOAuth] Device auth response:', {
            user_code: deviceAuth.user_code,
            expires_in: deviceAuth.expires_in
        });

        if (!deviceAuth.device_code || !deviceAuth.verification_uri_complete) {
            throw new Error('Invalid device authorization response');
        }

        // 3. Notify UI and open browser
        onProgress({
            status: 'awaiting_auth',
            url: deviceAuth.verification_uri_complete,
            userCode: deviceAuth.user_code,
            expiresIn: deviceAuth.expires_in
        });

        // Auto-open browser
        try {
            await shell.openExternal(deviceAuth.verification_uri_complete);
        } catch (e) {
            console.warn('[QwenOAuth] Failed to open browser:', e.message);
        }

        // 4. Poll for token
        let pollInterval = 2000; // 2 seconds
        const maxAttempts = Math.ceil(deviceAuth.expires_in / (pollInterval / 1000));

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (isCancelled) {
                onError('Authentication cancelled by user');
                return;
            }

            await sleep(pollInterval);

            const tokenBody = objectToUrlEncoded({
                grant_type: QWEN_OAUTH_GRANT_TYPE,
                client_id: QWEN_OAUTH_CLIENT_ID,
                device_code: deviceAuth.device_code,
                code_verifier
            });

            try {
                const tokenResponse = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: tokenBody
                });

                const tokenData = await tokenResponse.json();

                // Success case
                if (tokenData.access_token) {
                    console.log('[QwenOAuth] Token obtained successfully!');

                    const credentials = {
                        access_token: tokenData.access_token,
                        refresh_token: tokenData.refresh_token || null,
                        token_type: tokenData.token_type || 'Bearer',
                        resource_url: tokenData.resource_url || null,
                        expiry_date: tokenData.expires_in
                            ? Date.now() + (tokenData.expires_in * 1000)
                            : null
                    };

                    onSuccess(credentials);
                    return;
                }

                // Pending case (user hasn't authorized yet)
                if (tokenData.error === 'authorization_pending') {
                    onProgress({
                        status: 'polling',
                        attempt: attempt + 1,
                        maxAttempts
                    });
                    continue;
                }

                // Slow down case
                if (tokenData.error === 'slow_down') {
                    pollInterval = Math.min(pollInterval * 1.5, 10000);
                    console.log('[QwenOAuth] Server requested slow_down, interval now:', pollInterval);
                    continue;
                }

                // Access denied
                if (tokenData.error === 'access_denied') {
                    onError('Access denied. Please try again.');
                    return;
                }

                // Other error
                if (tokenData.error) {
                    onError(tokenData.error_description || tokenData.error);
                    return;
                }

            } catch (pollError) {
                console.error('[QwenOAuth] Poll error:', pollError.message);
                // Continue polling on network errors
            }
        }

        // Timeout
        onError('Authorization timed out. Please try again.');

    } catch (error) {
        console.error('[QwenOAuth] Device flow failed:', error);
        onError(error.message);
    }
}

/**
 * Refresh an access token using a refresh token
 * 
 * @param {string} refreshToken 
 * @returns {Promise<Object>} New credentials
 */
export async function refreshAccessToken(refreshToken) {
    const body = objectToUrlEncoded({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: QWEN_OAUTH_CLIENT_ID
    });

    const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error_description || data.error);
    }

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        token_type: data.token_type || 'Bearer',
        resource_url: data.resource_url || null,
        expiry_date: data.expires_in ? Date.now() + (data.expires_in * 1000) : null
    };
}

// ===== TOKEN PERSISTENCE (User-Isolated) =====

/**
 * Get the token storage path for a specific user
 * @param {string} userId 
 * @param {string} userDataPath - app.getPath('userData')
 */
export function getUserTokenPath(userId, userDataPath) {
    return path.join(userDataPath, 'user_data', userId, 'qwen_tokens.json');
}

/**
 * Save tokens for a specific user
 */
export async function saveUserTokens(userId, userDataPath, credentials) {
    const tokenPath = getUserTokenPath(userId, userDataPath);
    const dir = path.dirname(tokenPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(tokenPath, JSON.stringify(credentials, null, 2));
    console.log('[QwenOAuth] Tokens saved for user:', userId);
}

/**
 * Load tokens for a specific user
 */
export function loadUserTokens(userId, userDataPath) {
    const tokenPath = getUserTokenPath(userId, userDataPath);

    try {
        if (fs.existsSync(tokenPath)) {
            return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        }
    } catch (e) {
        console.error('[QwenOAuth] Failed to load user tokens:', e.message);
    }

    return null;
}

/**
 * Clear tokens for a specific user
 */
export function clearUserTokens(userId, userDataPath) {
    const tokenPath = getUserTokenPath(userId, userDataPath);

    try {
        if (fs.existsSync(tokenPath)) {
            fs.unlinkSync(tokenPath);
            console.log('[QwenOAuth] Tokens cleared for user:', userId);
        }
    } catch (e) {
        console.warn('[QwenOAuth] Failed to clear tokens:', e.message);
    }
}

// ===== LEGACY SUPPORT (Global tokens for backward compatibility) =====

const LEGACY_TOKEN_PATH = path.join(os.homedir(), '.qwen', 'oauth_creds.json');

/**
 * Load tokens from legacy location (used when no user session)
 */
export function loadLegacyTokens() {
    try {
        if (fs.existsSync(LEGACY_TOKEN_PATH)) {
            return JSON.parse(fs.readFileSync(LEGACY_TOKEN_PATH, 'utf8'));
        }
    } catch (e) {
        console.error('[QwenOAuth] Failed to load legacy tokens:', e.message);
    }
    return null;
}

/**
 * Save tokens to legacy location (for backward compatibility)
 */
export function saveLegacyTokens(credentials) {
    const dir = path.dirname(LEGACY_TOKEN_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LEGACY_TOKEN_PATH, JSON.stringify(credentials, null, 2));
}
