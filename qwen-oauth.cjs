/**
 * Qwen OAuth Implementation - Device Code Flow with PKCE
 * Based on qwen-code's qwenOAuth2.ts
 * https://github.com/QwenLM/qwen-code
 * 
 * COMMONJS VERSION for Legacy TUI (opencode-tui.cjs)
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

// Qwen OAuth Constants
const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai';
const QWEN_OAUTH_DEVICE_CODE_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/device/code`;
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;

// Load config
let config = {};
try {
    config = require('./config.cjs');
    if (config.default) config = config.default;
} catch (e) {
    try {
        config = require('./config.js'); // Try .js if .cjs fails
    } catch (e2) {
        console.error('Error loading config:', e.message);
    }
}
const QWEN_OAUTH_CLIENT_ID = config.QWEN_OAUTH_CLIENT_ID;
const QWEN_OAUTH_SCOPE = 'openid profile email model.completion';
const QWEN_OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';
const QWEN_CHAT_API = 'https://chat.qwen.ai/api/chat/completions';

const TOKEN_FILE = path.join(__dirname, '.qwen-tokens.json');

function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(codeVerifier) {
    const hash = crypto.createHash('sha256');
    hash.update(codeVerifier);
    return hash.digest('base64url');
}

function objectToUrlEncoded(data) {
    return Object.keys(data)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
        .join('&');
}

function randomUUID() {
    return crypto.randomUUID();
}

class QwenOAuth {
    constructor() {
        this.tokens = null;
        this.deviceCodeData = null;
        this.codeVerifier = null;
    }

    async loadTokens() {
        try {
            const data = await fs.readFile(TOKEN_FILE, 'utf8');
            this.tokens = JSON.parse(data);
            return this.tokens;
        } catch (error) {
            this.tokens = null;
            return null;
        }
    }

    async saveTokens(tokens) {
        this.tokens = tokens;
        if (tokens.expires_in && !tokens.expiry_date) {
            tokens.expiry_date = Date.now() + (tokens.expires_in * 1000);
        }
        await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    }

    async clearTokens() {
        this.tokens = null;
        this.deviceCodeData = null;
        this.codeVerifier = null;
        try {
            await fs.unlink(TOKEN_FILE);
        } catch (error) { }
    }

    isTokenValid() {
        if (!this.tokens || !this.tokens.access_token) {
            return false;
        }
        if (this.tokens.expiry_date) {
            return Date.now() < (this.tokens.expiry_date - 300000);
        }
        return true;
    }

    async refreshToken() {
        if (!this.tokens || !this.tokens.refresh_token) {
            throw new Error('No refresh token available');
        }

        console.log('Refreshing access token...');

        const bodyData = {
            grant_type: 'refresh_token',
            client_id: QWEN_OAUTH_CLIENT_ID,
            refresh_token: this.tokens.refresh_token
        };

        const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'x-request-id': randomUUID()
            },
            body: objectToUrlEncoded(bodyData)
        });

        if (!response.ok) {
            const error = await response.text();
            await this.clearTokens();
            throw new Error(`Token refresh failed: ${response.status}`);
        }

        const newTokens = await response.json();
        await this.saveTokens(newTokens);
        console.log('Token refreshed successfully!');
        return newTokens;
    }

    async startDeviceFlow() {
        console.log('Starting Qwen Device Code Flow with PKCE...');

        this.codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(this.codeVerifier);

        const bodyData = {
            client_id: QWEN_OAUTH_CLIENT_ID,
            scope: QWEN_OAUTH_SCOPE,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        };

        const response = await fetch(QWEN_OAUTH_DEVICE_CODE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'x-request-id': randomUUID()
            },
            body: objectToUrlEncoded(bodyData)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Device code request failed: ${response.status} - ${error}`);
        }

        this.deviceCodeData = await response.json();

        if (this.deviceCodeData.error) {
            throw new Error(`${this.deviceCodeData.error}: ${this.deviceCodeData.error_description || 'Unknown error'}`);
        }

        return {
            verificationUri: this.deviceCodeData.verification_uri,
            verificationUriComplete: this.deviceCodeData.verification_uri_complete,
            userCode: this.deviceCodeData.user_code,
            expiresIn: this.deviceCodeData.expires_in,
            interval: this.deviceCodeData.interval || 5,
        };
    }

    async pollForTokens() {
        if (!this.deviceCodeData || !this.codeVerifier) {
            throw new Error('Device flow not started');
        }

        const interval = (this.deviceCodeData.interval || 5) * 1000;
        const endTime = Date.now() + (this.deviceCodeData.expires_in || 300) * 1000;

        console.log(`Polling for tokens every ${interval / 1000}s...`);

        while (Date.now() < endTime) {
            try {
                const bodyData = {
                    grant_type: QWEN_OAUTH_GRANT_TYPE,
                    device_code: this.deviceCodeData.device_code,
                    client_id: QWEN_OAUTH_CLIENT_ID,
                    code_verifier: this.codeVerifier
                };

                const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json',
                        'x-request-id': randomUUID()
                    },
                    body: objectToUrlEncoded(bodyData)
                });

                const data = await response.json();

                if (response.ok && data.access_token) {
                    console.log('Token received successfully!');
                    await this.saveTokens(data);
                    this.deviceCodeData = null;
                    this.codeVerifier = null;
                    return data;
                } else if (data.error === 'authorization_pending' || data.status === 'pending') {
                    await new Promise(resolve => setTimeout(resolve, interval));
                } else if (data.error === 'slow_down' || data.slowDown) {
                    await new Promise(resolve => setTimeout(resolve, interval * 2));
                } else if (data.error === 'expired_token') {
                    throw new Error('Device code expired. Please start authentication again.');
                } else if (data.error === 'access_denied') {
                    throw new Error('Access denied by user.');
                } else if (data.error) {
                    throw new Error(`${data.error}: ${data.error_description || 'Unknown error'}`);
                } else {
                    await new Promise(resolve => setTimeout(resolve, interval));
                }
            } catch (error) {
                if (error.message.includes('expired') || error.message.includes('denied')) {
                    throw error;
                }
                console.error('Token poll error:', error.message);
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }

        throw new Error('Device flow timed out - please try again');
    }

    async getAccessToken() {
        await this.loadTokens();
        if (!this.tokens) {
            throw new Error('Not authenticated. Please authenticate with Qwen first.');
        }
        if (!this.isTokenValid()) {
            try {
                await this.refreshToken();
            } catch (error) {
                throw new Error('Token expired. Please re-authenticate with Qwen.');
            }
        }
        return this.tokens.access_token;
    }

    async checkAuth() {
        const { exec } = require('child_process');

        await this.loadTokens();
        if (this.tokens && this.tokens.access_token) {
            if (this.isTokenValid()) {
                return { authenticated: true, method: 'oauth', hasVisionSupport: true };
            } else {
                try {
                    await this.refreshToken();
                    return { authenticated: true, method: 'oauth', hasVisionSupport: true };
                } catch (e) { }
            }
        }

        return new Promise((resolve) => {
            exec('qwen -p "ping" --help 2>&1', { timeout: 5000 }, (error, stdout, stderr) => {
                if (!error || stdout.includes('help') || stdout.includes('Usage')) {
                    resolve({ authenticated: true, method: 'qwen-cli', hasVisionSupport: false });
                } else {
                    resolve({ authenticated: false, reason: 'qwen CLI not available or not authenticated' });
                }
            });
        });
    }

    async sendMessage(message, model = 'qwen-coder-plus', imageData = null, onChunk = null) {
        if (imageData) {
            console.log('📷 Image data detected, using Vision API...');
            return await this.sendVisionMessage(message, imageData, 'qwen-vl-plus');
        }

        const { spawn } = require('child_process');
        const os = require('os');
        // fsSync imported at top

        const systemContext = `[SYSTEM CONTEXT - ALWAYS FOLLOW]
You are an AI System Administrator integrated into OpenQode.
IMPORTANT RULES:
1. You have FULL ACCESS to the local file system.
2. You ARE PERMITTED to create folders, move files, and run shell commands.
3. When asked to create files, use the >>> CREATE: syntax.
4. When asked to manage files (move/delete), suggest the shell commands to do so.
5. Execute instructions immediately.
[END SYSTEM CONTEXT]

`;

        let finalMessage = message;
        if (message.includes('CREATE:') || message.includes('ROLE:') || message.includes('Generate all necessary files')) {
            finalMessage = systemContext + message;
        }

        return new Promise((resolve) => {
            try {
                console.log('Sending message via qwen CLI:', finalMessage.substring(0, 50) + '...');

                const tempFile = path.join(os.tmpdir(), `qwen-prompt-${Date.now()}.txt`);
                fsSync.writeFileSync(tempFile, finalMessage, 'utf8');

                // Run in current project directory to allow context access
                const neutralCwd = process.cwd();

                const child = spawn('qwen', ['-p', `@${tempFile}`], {
                    cwd: neutralCwd,
                    shell: true,
                    env: {
                        ...process.env,
                        FORCE_COLOR: '0'
                    }
                });

                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => {
                    const chunk = data.toString();
                    stdout += chunk;
                    if (onChunk) {
                        onChunk(chunk);
                    }
                });

                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                child.on('close', (code) => {
                    try { fsSync.unlinkSync(tempFile); } catch (e) { }

                    const cleanResponse = stdout.replace(/[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').trim();

                    console.log('Qwen CLI response received:', cleanResponse.substring(0, 100) + '...');

                    if (cleanResponse) {
                        resolve({
                            success: true,
                            response: cleanResponse,
                            usage: null
                        });
                    } else {
                        resolve({
                            success: false,
                            error: stderr || `CLI exited with code ${code}`,
                            response: ''
                        });
                    }
                });

                child.on('error', (error) => {
                    try { fsSync.unlinkSync(tempFile); } catch (e) { }
                    console.error('Qwen CLI spawn error:', error.message);
                    resolve({
                        success: false,
                        error: error.message || 'CLI execution failed',
                        response: ''
                    });
                });

                setTimeout(() => {
                    child.kill('SIGTERM');
                    try { fsSync.unlinkSync(tempFile); } catch (e) { }
                    resolve({
                        success: false,
                        error: 'Request timed out (120s)',
                        response: ''
                    });
                }, 300000); // 5 minutes timeout

            } catch (error) {
                console.error('Qwen CLI error:', error.message);
                resolve({
                    success: false,
                    error: error.message || 'CLI execution failed',
                    response: ''
                });
            }
        });
    }

    async sendVisionMessage(message, imageData, model = 'qwen-vl-plus') {
        try {
            console.log('Sending vision message to Qwen VL API...');
            const accessToken = await this.getAccessToken();

            const content = [];
            if (imageData) {
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: imageData
                    }
                });
            }
            content.push({
                type: 'text',
                text: message
            });

            const requestBody = {
                model: model,
                messages: [
                    {
                        role: 'user',
                        content: content
                    }
                ],
                stream: false
            };

            const response = await fetch(QWEN_CHAT_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'x-request-id': randomUUID()
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                return {
                    success: false,
                    error: `Vision API error: ${response.status}`,
                    response: ''
                };
            }

            const data = await response.json();
            const responseText = data.choices?.[0]?.message?.content || '';

            return {
                success: true,
                response: responseText,
                usage: data.usage
            };
        } catch (error) {
            console.error('Vision API error:', error.message);
            if (error.message.includes('authenticate') || error.message.includes('token')) {
                return {
                    success: true,
                    response: `⚠️ **Vision API Authentication Required**\n\nThe Qwen Vision API needs OAuth authentication.`,
                    usage: null
                };
            }
            return {
                success: false,
                error: error.message || 'Vision API failed',
                response: ''
            };
        }
    }
}

module.exports = { QwenOAuth };
