import fs from 'fs';
import path from 'path';
import https from 'https';
import os from 'os';

/**
 * Ollama Cloud API Bridge for Goose Ultra
 * Base URL: https://ollama.com/api
 */

// We'll manage key storage via main.js using keytar
let cachedApiKey = null;

export function setApiKey(key) {
    cachedApiKey = key;
}

let activeRequest = null;

export function abortActiveChat() {
    if (activeRequest) {
        try {
            activeRequest.destroy();
        } catch (e) { }
        activeRequest = null;
    }
}

export async function streamChat(messages, model = 'gpt-oss:120b', onChunk, onComplete, onError, onStatus) {
    abortActiveChat();

    if (!cachedApiKey) {
        onError(new Error('OLLAMA_CLOUD_KEY_MISSING: Please set your Ollama Cloud API Key in Settings.'));
        return;
    }

    const log = (msg) => {
        if (onStatus) onStatus(`[Ollama] ${msg}`);
    };

    const body = JSON.stringify({
        model,
        messages,
        stream: true
    });

    const options = {
        hostname: 'ollama.com',
        port: 443,
        path: '/api/chat',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cachedApiKey}`,
            'Content-Length': Buffer.byteLength(body)
        }
    };

    log(`Connecting to ollama.com as ${model}...`);

    const req = https.request(options, (res) => {
        activeRequest = req;
        let fullResponse = '';

        log(`Response status: ${res.statusCode}`);

        if (res.statusCode !== 200) {
            let errBody = '';
            res.on('data', (c) => errBody += c.toString());
            res.on('end', () => {
                log(`API Error: ${errBody}`);
                onError(new Error(`Ollama API Error ${res.statusCode}: ${errBody}`));
            });
            return;
        }

        res.setEncoding('utf8');
        let buffer = '';

        res.on('data', (chunk) => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line);
                    const content = parsed.message?.content || '';
                    if (content) {
                        fullResponse += content;
                        onChunk(content);
                    }
                    // Check if this is the final message
                    if (parsed.done === true) {
                        log('Received done signal from Ollama');
                    }
                } catch (e) {
                    // Ignore malformed JSON chunks
                    log(`Parse error (ignored): ${e.message}`);
                }
            }
        });

        res.on('end', () => {
            // Process any remaining data in buffer
            if (buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer);
                    const content = parsed.message?.content || '';
                    if (content) {
                        fullResponse += content;
                        onChunk(content);
                    }
                } catch (e) {
                    // Final chunk wasn't valid JSON, that's fine
                }
            }
            log(`Stream complete. Total response length: ${fullResponse.length}`);
            onComplete(fullResponse);
            activeRequest = null;
        });

        res.on('error', (e) => {
            log(`Response error: ${e.message}`);
            onError(e);
            activeRequest = null;
        });
    });

    req.on('error', (e) => {
        log(`Request error: ${e.message}`);
        onError(e);
        activeRequest = null;
    });

    req.setTimeout(120000, () => {
        log('Request timeout after 120s');
        req.destroy();
        onError(new Error('Ollama Cloud request timeout'));
    });

    req.setNoDelay(true);
    req.write(body);
    req.end();
}

/**
 * Fetch available models from Ollama Cloud
 */
export async function listModels() {
    if (!cachedApiKey) return [];

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'ollama.com',
            port: 443,
            path: '/api/tags',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${cachedApiKey}`
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (c) => body += c.toString());
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    resolve(data.models || []);
                } catch (e) {
                    resolve([]);
                }
            });
        });

        req.on('error', (e) => resolve([]));
        req.end();
    });
}
