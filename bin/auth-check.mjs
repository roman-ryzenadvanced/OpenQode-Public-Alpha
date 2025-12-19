#!/usr/bin/env node
/**
 * OpenQode Auth Check (Centralized)
 *
 * Goal: Make Gen5 TUI + Goose use the SAME auth as Qwen CLI (option [5]).
 * This script intentionally does NOT run the legacy `bin/auth.js` flow.
 *
 * Exit codes:
 * - 0: Qwen CLI present + OAuth creds present
 * - 1: Qwen CLI missing
 * - 2: Qwen CLI present but not authenticated
 */

import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const argv = process.argv.slice(2);
const quiet = argv.includes('--quiet') || argv.includes('-q');

const C = {
	reset: '\x1b[0m',
	cyan: '\x1b[36m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	red: '\x1b[31m',
	dim: '\x1b[2m',
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPENCODE_ROOT = path.resolve(__dirname, '..');

const findQwenCliJs = () => {
	const local = path.join(OPENCODE_ROOT, 'node_modules', '@qwen-code', 'qwen-code', 'cli.js');
	if (fs.existsSync(local)) return local;
	const appData = process.env.APPDATA || '';
	if (appData) {
		const globalCli = path.join(appData, 'npm', 'node_modules', '@qwen-code', 'qwen-code', 'cli.js');
		if (fs.existsSync(globalCli)) return globalCli;
	}
	return null;
};

const checkQwenInstalled = () => new Promise((resolve) => {
	const cliJs = findQwenCliJs();
	if (cliJs) return resolve(true);

	// Fallback to PATH.
	const command = process.platform === 'win32' ? 'qwen.cmd' : 'qwen';
	const isWin = process.platform === 'win32';
	const child = spawn(command, ['--version'], { shell: isWin, timeout: 5000 });
	child.on('error', () => resolve(false));
	child.on('close', (code) => resolve(code === 0));
	setTimeout(() => { try { child.kill(); } catch { } resolve(false); }, 5000);
});

const readOauthCreds = () => {
	const tokenPath = path.join(os.homedir(), '.qwen', 'oauth_creds.json');
	if (!fs.existsSync(tokenPath)) return { ok: false, reason: 'missing', tokenPath };
	try {
		const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
		if (!data?.access_token) return { ok: false, reason: 'invalid', tokenPath };
		const expiry = Number(data?.expiry_date || 0);
		if (expiry && expiry < Date.now() - 30_000) return { ok: false, reason: 'expired', tokenPath };
		return { ok: true, tokenPath, expiry };
	} catch {
		return { ok: false, reason: 'unreadable', tokenPath };
	}
};

const main = async () => {
	if (!quiet) {
		console.log('');
		console.log(C.cyan + 'OpenQode Authentication Check' + C.reset);
		console.log(C.dim + 'Verifies Qwen CLI OAuth (shared across Gen5 + Goose).' + C.reset);
		console.log('');
	}

	const installed = await checkQwenInstalled();
	if (!installed) {
		if (!quiet) {
			console.log(C.red + 'qwen CLI not found.' + C.reset);
			console.log(C.yellow + 'Install:' + C.reset + ' npm install -g @qwen-code/qwen-code');
			console.log('');
		}
		process.exit(1);
	}

	const creds = readOauthCreds();
	if (!creds.ok) {
		if (!quiet) {
			console.log(C.yellow + 'Qwen CLI is installed but not authenticated yet.' + C.reset);
			console.log(C.dim + `Expected token file: ${creds.tokenPath}` + C.reset);
			console.log('');
			console.log(C.cyan + 'Fix:' + C.reset);
			console.log('  1) Run option [5] in OpenQode launcher');
			console.log('  2) In Qwen CLI run: /auth');
			console.log('  3) Return and retry Gen5/Goose');
			console.log('');
		}
		process.exit(2);
	}

	if (!quiet) {
		console.log(C.green + 'OK: Qwen CLI + OAuth ready.' + C.reset);
		console.log(C.dim + `Token: ${creds.tokenPath}` + C.reset);
		console.log('');
	}

	process.exit(0);
};

main().catch((e) => {
	if (!quiet) console.error(C.red + String(e?.message || e) + C.reset);
	process.exit(1);
});
