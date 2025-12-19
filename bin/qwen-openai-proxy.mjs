#!/usr/bin/env node
/**
 * Qwen OpenAI-Compatible Proxy (local)
 *
 * Purpose:
 * - Lets tools like Goose talk "OpenAI chat completions" to Qwen via the same auth
 *   OpenQode already uses (qwen CLI / local OAuth tokens).
 *
 * Endpoints:
 * - GET  /health
 * - GET  /v1/models
 * - POST /v1/chat/completions   (supports stream/non-stream)
 */

import http from 'http';
import { randomUUID } from 'crypto';
import { QwenOAuth } from '../qwen-oauth.mjs';

const stripAnsi = (input) => String(input || '').replace(
	/[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
	''
);

const readJson = async (req) => {
	const chunks = [];
	for await (const c of req) chunks.push(c);
	const raw = Buffer.concat(chunks).toString('utf8');
	if (!raw.trim()) return {};
	try {
		return JSON.parse(raw);
	} catch (e) {
		throw new Error('Invalid JSON body');
	}
};

const respondJson = (res, status, body) => {
	const text = JSON.stringify(body);
	res.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'content-length': Buffer.byteLength(text),
	});
	res.end(text);
};

const buildPromptFromMessages = (messages) => {
	const parts = [];
	for (const m of Array.isArray(messages) ? messages : []) {
		const role = String(m?.role || 'user').toUpperCase();
		const content = typeof m?.content === 'string'
			? m.content
			: Array.isArray(m?.content)
				? m.content.map((c) => c?.text || '').filter(Boolean).join('\n')
				: String(m?.content ?? '');
		if (!content) continue;
		parts.push(`[${role}]\n${content}`);
	}
	return parts.join('\n\n');
};

const parseArgs = () => {
	const argv = process.argv.slice(2);
	const get = (name, fallback) => {
		const idx = argv.findIndex(a => a === `--${name}` || a === `-${name[0]}`);
		if (idx === -1) return fallback;
		const v = argv[idx + 1];
		return v ?? fallback;
	};
	return {
		host: get('host', '127.0.0.1'),
		port: Number(get('port', '18181')) || 18181,
	};
};

const { host, port } = parseArgs();
const qwen = new QwenOAuth();

const server = http.createServer(async (req, res) => {
	try {
		const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);

		if (req.method === 'GET' && url.pathname === '/health') {
			return respondJson(res, 200, { ok: true, service: 'qwen-openai-proxy', port });
		}

		if (req.method === 'GET' && url.pathname === '/v1/models') {
			return respondJson(res, 200, {
				object: 'list',
				data: [
					{ id: 'qwen-coder-plus', object: 'model', owned_by: 'qwen' },
					{ id: 'qwen-plus', object: 'model', owned_by: 'qwen' },
					{ id: 'qwen-turbo', object: 'model', owned_by: 'qwen' },
				]
			});
		}

		if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
			const body = await readJson(req);
			const requestId = randomUUID();
			const model = String(body?.model || 'qwen-coder-plus');
			const prompt = buildPromptFromMessages(body?.messages);
			const stream = Boolean(body?.stream);

			if (!prompt.trim()) {
				return respondJson(res, 400, { error: { message: 'messages is required', type: 'invalid_request_error' } });
			}

			if (stream) {
				res.writeHead(200, {
					'content-type': 'text/event-stream; charset=utf-8',
					'cache-control': 'no-cache, no-transform',
					'connection': 'keep-alive',
				});

				const writeEvent = (payload) => {
					res.write(`data: ${JSON.stringify(payload)}\n\n`);
				};

				const onChunk = (chunk) => {
					const clean = stripAnsi(chunk);
					if (!clean) return;
					writeEvent({
						id: requestId,
						object: 'chat.completion.chunk',
						model,
						choices: [{ index: 0, delta: { content: clean }, finish_reason: null }]
					});
				};

				const result = await qwen.sendMessage(prompt, model, null, onChunk, null);

				if (!result?.success) {
					writeEvent({
						id: requestId,
						object: 'chat.completion.chunk',
						model,
						choices: [{ index: 0, delta: {}, finish_reason: 'error' }]
					});
					res.write(`data: [DONE]\n\n`);
					res.end();
					return;
				}

				writeEvent({
					id: requestId,
					object: 'chat.completion.chunk',
					model,
					choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
				});
				res.write(`data: [DONE]\n\n`);
				res.end();
				return;
			}

			const result = await qwen.sendMessage(prompt, model, null, null, null);
			if (!result?.success) {
				return respondJson(res, 500, { error: { message: result?.error || 'Qwen request failed', type: 'server_error' } });
			}

			return respondJson(res, 200, {
				id: requestId,
				object: 'chat.completion',
				created: Math.floor(Date.now() / 1000),
				model,
				choices: [
					{
						index: 0,
						message: { role: 'assistant', content: String(result.response || '') },
						finish_reason: 'stop'
					}
				],
				usage: null
			});
		}

		respondJson(res, 404, { error: { message: 'Not found' } });
	} catch (e) {
		respondJson(res, 500, { error: { message: e.message || 'Server error' } });
	}
});

server.listen(port, host, () => {
	// Keep output minimal (this may be launched from the TUI).
	console.log(`qwen-openai-proxy listening on http://${host}:${port}`);
});

