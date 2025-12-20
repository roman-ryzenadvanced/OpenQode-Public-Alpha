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

        if (res.statusCode !== 200) {
            let errBody = '';
            res.on('data', (c) => errBody += c.toString());
            res.on('end', () => {
                onError(new Error(`Ollama API Error ${res.statusCode}: ${errBody}`));
            });
            return;
        }

        res.setEncoding('utf8');
        let buffer = '';

        res.on('data', (chunk) => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line);
                    const content = parsed.message?.content || '';
                    if (content) {
                        fullResponse += content;
                        onChunk(content);
                    }
                    if (parsed.done) {
                        // Request is done according to Ollama API
                    }
                } catch (e) {
                    // Ignore malformed JSON chunks
                }
            }
        });

        res.on('end', () => {
            onComplete(fullResponse);
        });
    });

    req.on('error', (e) => {
        onError(e);
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
