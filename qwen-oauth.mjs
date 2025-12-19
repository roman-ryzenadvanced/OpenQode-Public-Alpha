/**
 * Qwen OAuth / CLI Adapter for OpenQode
 *
 * Primary goal: make Gen5 TUI + Goose use the SAME auth as the Qwen CLI (option [4]).
 *
 * Strategy:
 * - Text chat: always call `qwen` CLI with `--output-format stream-json` and parse deltas.
 * - Vision: best-effort direct API call using Qwen CLI's `~/.qwen/oauth_creds.json`.
 *
 * Notes:
 * - We intentionally do NOT depend on the legacy `bin/auth.js` flow for normal chat.
 * - If auth is missing, instruct the user to run Qwen CLI and `/auth`.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fetchWithRetry } from './lib/retry-handler.mjs';

const require = createRequire(import.meta.url);
let config = {};
try {
	config = require('./config.cjs');
	if (config.default) config = config.default;
} catch {
	config = {};
}

const QWEN_OAUTH_CLIENT_ID = config.QWEN_OAUTH_CLIENT_ID || null;
const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai';
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;

const QWEN_CHAT_API = 'https://chat.qwen.ai/api/v1/chat/completions';

const stripAnsi = (input) => String(input || '').replace(
	/[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
	''
);

const randomUUID = () => crypto.randomUUID();

const getOauthCredPath = () => path.join(os.homedir(), '.qwen', 'oauth_creds.json');

const normalizeModel = (model) => {
	const m = String(model || '').trim();
	// OpenQode/Goose use friendly IDs; Qwen portal currently accepts "coder-model".
	// Keep this mapping centralized so all launch modes behave the same.
	const map = {
		'qwen-coder-plus': 'coder-model',
		'qwen-plus': 'coder-model',
		'qwen-turbo': 'coder-model',
		'coder-model': 'coder-model',
	};
	return map[m] || 'coder-model';
};

/**
 * Get the Qwen CLI command (local or global installation)
 */
const getQwenCommand = () => {
	const isWin = process.platform === 'win32';
	// Check for local installation first
	const localPath = path.join(path.dirname(import.meta.url.replace('file:///', '')), 'node_modules', '.bin', isWin ? 'qwen.cmd' : 'qwen');
	if (fs.existsSync(localPath)) {
		return localPath;
	}
	// Fall back to global
	return isWin ? 'qwen.cmd' : 'qwen';
};

class QwenOAuth {
	constructor() {
		this.tokens = null;
	}

	async loadTokens() {
		const tokenPath = getOauthCredPath();
		if (!fs.existsSync(tokenPath)) {
			this.tokens = null;
			return null;
		}
		try {
			const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
			if (!data?.access_token) {
				this.tokens = null;
				return null;
			}
			this.tokens = {
				access_token: data.access_token,
				refresh_token: data.refresh_token,
				token_type: data.token_type || 'Bearer',
				expiry_date: Number(data.expiry_date || 0),
				resource_url: data.resource_url,
				_tokenPath: tokenPath,
			};
			return this.tokens;
		} catch {
			this.tokens = null;
			return null;
		}
	}

	isTokenValid() {
		const expiry = Number(this.tokens?.expiry_date || 0);
		if (!expiry) return true;
		return expiry > Date.now() + 30_000;
	}

	async refreshToken() {
		await this.loadTokens();
		if (!this.tokens?.refresh_token) return false;
		if (!QWEN_OAUTH_CLIENT_ID) return false;

		const body = new URLSearchParams();
		body.set('grant_type', 'refresh_token');
		body.set('refresh_token', this.tokens.refresh_token);
		body.set('client_id', QWEN_OAUTH_CLIENT_ID);

		const resp = await fetchWithRetry(QWEN_OAUTH_TOKEN_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Accept': 'application/json',
				'x-request-id': randomUUID(),
			},
			body: body.toString(),
		});

		if (!resp.ok) return false;
		const data = await resp.json().catch(() => null);
		if (!data?.access_token) return false;

		const tokenPath = this.tokens?._tokenPath || getOauthCredPath();
		const next = {
			access_token: data.access_token,
			token_type: data.token_type || this.tokens.token_type || 'Bearer',
			refresh_token: data.refresh_token || this.tokens.refresh_token,
			resource_url: data.resource_url || this.tokens.resource_url,
			expiry_date: data.expiry_date || (Date.now() + Number(data.expires_in || 3600) * 1000),
		};
		try {
			fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
			fs.writeFileSync(tokenPath, JSON.stringify(next, null, 2));
		} catch {
			// ignore write errors; token is still usable in-memory
		}
		this.tokens = { ...next, _tokenPath: tokenPath };
		return true;
	}

	async checkAuth() {
		await this.loadTokens();
		if (this.tokens?.access_token && this.isTokenValid()) {
			return { authenticated: true, method: 'qwen-cli-oauth', hasVisionSupport: true };
		}

		// Fallback: check if qwen CLI exists (but token may be missing).
		const { spawn } = await import('child_process');
		const cmd = getQwenCommand();
		const isWin = process.platform === 'win32';
		return await new Promise((resolve) => {
			const child = spawn(cmd, ['--version'], { shell: isWin, timeout: 5000, windowsHide: true });
			child.on('error', () => resolve({ authenticated: false, reason: 'qwen CLI not available' }));
			child.on('close', (code) => {
				if (code === 0) {
					resolve({ authenticated: false, reason: 'qwen CLI not authenticated', method: 'qwen-cli' });
				} else {
					resolve({ authenticated: false, reason: 'qwen CLI not available' });
				}
			});
			setTimeout(() => { try { child.kill(); } catch { } resolve({ authenticated: false, reason: 'CLI check timeout' }); }, 5000);
		});
	}

	async sendMessage(message, model = 'qwen-coder-plus', imageData = null, onChunk = null, systemPrompt = null) {
		if (imageData) {
			return await this.sendVisionMessage(message, imageData, 'qwen-vl-plus');
		}

		await this.loadTokens();
		if (!this.tokens?.access_token) {
			return {
				success: false,
				error: 'Not authenticated. Open option [4] and run /auth.',
				response: '',
			};
		}

		if (!this.isTokenValid()) {
			const ok = await this.refreshToken();
			if (!ok) {
				return {
					success: false,
					error: 'Token expired. Open option [4] and run /auth.',
					response: '',
				};
			}
		}

		const messages = [];
		if (systemPrompt) messages.push({ role: 'system', content: String(systemPrompt) });
		messages.push({ role: 'user', content: String(message ?? '') });

		const requestBody = {
			model: normalizeModel(model),
			messages,
			stream: Boolean(onChunk),
		};

		const apiEndpoint = this.tokens?.resource_url
			? `https://${this.tokens.resource_url}/v1/chat/completions`
			: QWEN_CHAT_API;

		try {
			const response = await fetch(apiEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.tokens.access_token}`,
					'x-request-id': randomUUID(),
				},
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => '');
				return { success: false, error: `API error: ${response.status} ${errorText}`.trim(), response: '' };
			}

			if (onChunk) {
				const reader = response.body?.getReader?.();
				if (!reader) {
					const data = await response.json().catch(() => ({}));
					const text = data.choices?.[0]?.message?.content || '';
					return { success: true, response: String(text) };
				}

				const decoder = new TextDecoder();
				let buffer = '';
				let full = '';
				let lastSig = '';

				// Minimal line-based SSE parser for OpenAI-compatible streaming:
				// data: {"choices":[{"delta":{"content":"..."}}]}
				const emitFromDataLine = (dataLine) => {
					const s = String(dataLine || '').trim();
					if (!s) return;
					if (s === '[DONE]') return;
					let obj;
					try { obj = JSON.parse(s); } catch { return; }
					const id = String(obj?.id || '');
					const index = String(obj?.choices?.[0]?.index ?? 0);
					const delta = obj?.choices?.[0]?.delta?.content;
					if (typeof delta === 'string' && delta.length) {
						const sig = `${id}:${index}:${delta}`;
						// Some Qwen portal streams repeat identical delta frames; ignore exact repeats.
						if (sig === lastSig) return;
						lastSig = sig;
						full += delta;
						onChunk(delta);
					}
				};

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });

					let idx;
					while ((idx = buffer.indexOf('\n')) !== -1) {
						const line = buffer.slice(0, idx);
						buffer = buffer.slice(idx + 1);
						const trimmed = line.trim();
						if (!trimmed.startsWith('data:')) continue;
						emitFromDataLine(trimmed.slice(5).trim());
					}
				}

				// Flush remaining buffer (best-effort).
				const remaining = buffer.trim();
				if (remaining.startsWith('data:')) emitFromDataLine(remaining.slice(5).trim());

				return { success: true, response: full };
			}

			const data = await response.json().catch(() => ({}));
			const responseText = data.choices?.[0]?.message?.content || '';
			return { success: true, response: String(responseText), usage: data.usage };
		} catch (e) {
			return { success: false, error: e?.message || String(e), response: '' };
		}
	}

	async getAccessToken() {
		await this.loadTokens();
		if (!this.tokens?.access_token) throw new Error('Not authenticated');
		if (!this.isTokenValid()) {
			const ok = await this.refreshToken();
			if (!ok) throw new Error('Token expired. Re-auth in Qwen CLI using /auth.');
		}
		return this.tokens.access_token;
	}

	async sendVisionMessage(message, imageData, model = 'qwen-vl-plus') {
		try {
			const accessToken = await this.getAccessToken();

			const content = [];
			if (imageData) {
				content.push({
					type: 'image_url',
					image_url: { url: imageData },
				});
			}
			content.push({ type: 'text', text: String(message ?? '') });

			const requestBody = {
				model,
				messages: [{ role: 'user', content }],
				stream: false,
			};

			const response = await fetchWithRetry(QWEN_CHAT_API, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`,
					'x-request-id': randomUUID(),
				},
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => '');
				return { success: false, error: `Vision API error: ${response.status} ${errorText}`.trim(), response: '' };
			}

			const data = await response.json().catch(() => ({}));
			const responseText = data.choices?.[0]?.message?.content || '';
			return { success: true, response: responseText, usage: data.usage };
		} catch (e) {
			return { success: false, error: e?.message || String(e), response: '' };
		}
	}
}

export { QwenOAuth };
