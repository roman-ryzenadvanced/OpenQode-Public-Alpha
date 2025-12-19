/**
 * Qwen API Bridge for Goose Ultra
 * 
 * Uses the SAME token infrastructure as QwenOAuth (qwen-oauth.mjs)
 * Token location: ~/.qwen/oauth_creds.json
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import os from 'os';
import crypto from 'crypto';

const QWEN_CHAT_API = 'https://chat.qwen.ai/api/v1/chat/completions';

const getOauthCredPath = () => path.join(os.homedir(), '.qwen', 'oauth_creds.json');

const normalizeModel = (model) => {
    const m = String(model || '').trim();
    const map = {
        'qwen-coder-plus': 'coder-model',
        'qwen-plus': 'coder-model',
        'qwen-turbo': 'coder-model',
        'coder-model': 'coder-model',
    };
    return map[m] || 'coder-model';
};

export function loadTokens() {
    const tokenPath = getOauthCredPath();
    try {
        if (fs.existsSync(tokenPath)) {
            const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
            if (data.access_token) {
                console.log('[QwenAPI] Loaded tokens from:', tokenPath);
                return {
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                    token_type: data.token_type || 'Bearer',
                    expiry_date: Number(data.expiry_date || 0),
                    resource_url: data.resource_url,
                };
            }
        }
    } catch (e) {
        console.error('[QwenAPI] Token load error:', e.message);
    }
    console.warn('[QwenAPI] No valid tokens found at', tokenPath);
    return null;
}

function isTokenValid(tokens) {
    const expiry = Number(tokens?.expiry_date || 0);
    if (!expiry) return true;
    return expiry > Date.now() + 30_000;
}

function getApiEndpoint(tokens) {
    if (tokens?.resource_url) {
        return `https://${tokens.resource_url}/v1/chat/completions`;
    }
    return QWEN_CHAT_API;
}

// Track active request to prevent stream interleaving
let activeRequest = null;

export function abortActiveChat() {
    if (activeRequest) {
        console.log('[QwenAPI] Aborting previous request...');
        try {
            activeRequest.destroy();
        } catch (e) {
            console.warn('[QwenAPI] Abort warning:', e.message);
        }
        activeRequest = null;
    }
}

export async function streamChat(messages, model = 'qwen-coder-plus', onChunk, onComplete, onError, onStatus) {
    // Abort any existing request to prevent interleaving
    abortActiveChat();

    const log = (msg) => {
        console.log('[QwenAPI]', msg);
        if (onStatus) onStatus(msg);
    };

    log('Loading tokens...');
    const tokens = loadTokens();

    if (!tokens?.access_token) {
        log('Error: No tokens found.');
        console.error('[QwenAPI] Authentication missing. No valid tokens found.');
        onError(new Error('AUTHENTICATION_REQUIRED: Please run OpenQode > Option 4, then /auth in Qwen CLI.'));
        return;
    }

    if (!isTokenValid(tokens)) {
        log('Error: Tokens expired.');
        console.error('[QwenAPI] Token expired.');
        onError(new Error('TOKEN_EXPIRED: Please run OpenQode > Option 4 and /auth again.'));
        return;
    }

    const endpoint = getApiEndpoint(tokens);
    const url = new URL(endpoint);
    const requestId = crypto.randomUUID();

    const body = JSON.stringify({
        model: normalizeModel(model),
        messages: messages,
        stream: true
    });

    log(`Connecting to ${url.hostname}...`);
    console.log(`[QwenAPI] Calling ${url.href} with model ${normalizeModel(model)}`);

    const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokens.access_token}`,
            'x-request-id': requestId,
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const req = https.request(options, (res) => {
        activeRequest = req;
        let fullResponse = '';

        if (res.statusCode !== 200) {
            let errBody = '';
            res.on('data', (c) => errBody += c.toString());
            res.on('end', () => {
                onError(new Error(`API Error ${res.statusCode}: ${errBody}`));
            });
            return;
        }

        res.setEncoding('utf8');
        let buffer = '';

        res.on('data', (chunk) => {
            buffer += chunk;

            // split by double newline or newline
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line

            for (const line of lines) {
                const trimmed = line.trim();
                // Check prefix
                if (!trimmed.startsWith('data: ')) continue;

                const data = trimmed.replace('data: ', '').trim();
                if (data === '[DONE]') {
                    onComplete(fullResponse);
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    // Qwen strict response matching
                    const choice = parsed.choices?.[0];
                    const content = choice?.delta?.content || choice?.message?.content || '';

                    if (content) {
                        fullResponse += content;
                        onChunk(content);
                    }
                } catch (e) {
                    // Ignore parsing errors for intermediate crumbs
                }
            }
        });

        res.on('end', () => {
            onComplete(fullResponse);
        });
    });

    req.on('error', (e) => {
        console.error('[QwenAPI] Request error:', e.message);
        onError(e);
    });
    req.write(body);
    req.end();
}
