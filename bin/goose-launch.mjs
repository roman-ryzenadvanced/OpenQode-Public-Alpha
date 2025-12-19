#!/usr/bin/env node
/**
 * Goose Launcher (Windows-friendly)
 *
 * Starts a local OpenAI-compatible proxy backed by the same Qwen auth OpenQode uses,
 * then launches Goose in "web" mode pointing to that proxy.
 *
 * Usage:
 *   node bin/goose-launch.mjs web [--port 3000] [--proxy-port 18181] [--model qwen-coder-plus] [--open] [--no-window]
 *   node bin/goose-launch.mjs status
 *   node bin/goose-launch.mjs stop
 */

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPENCODE_ROOT = path.resolve(__dirname, '..');

const STATE_DIR = path.join(OPENCODE_ROOT, '.opencode');
const PROXY_STATE = path.join(STATE_DIR, 'qwen-proxy.json');
const GOOSE_STATE = path.join(STATE_DIR, 'goose-web.json');
const GOOSE_ELECTRON_LOG = path.join(STATE_DIR, 'goose-electron.log');

const getCargoBinDir = () => {
	if (process.platform !== 'win32') return null;
	const home = process.env.USERPROFILE || process.env.HOME || '';
	if (!home) return null;
	const p = path.join(home, '.cargo', 'bin');
	return fs.existsSync(p) ? p : null;
};

const withCargoOnPath = (env = process.env) => {
	const cargoBin = getCargoBinDir();
	if (!cargoBin) return { ...env };
	const current = String(env.PATH || env.Path || '');
	if (current.toLowerCase().includes(cargoBin.toLowerCase())) return { ...env };
	return { ...env, PATH: `${cargoBin};${current}` };
};

const findVsDevCmd = () => {
	if (process.platform !== 'win32') return null;
	const pf86 = process.env['ProgramFiles(x86)'] || '';
	const vswhere = path.join(pf86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
	if (!fs.existsSync(vswhere)) return null;
	try {
		const r = spawnSync(vswhere, [
			'-latest',
			'-products', '*',
			'-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
			'-property', 'installationPath'
		], { encoding: 'utf8' });
		const installPath = String(r.stdout || '').trim();
		if (!installPath) return null;
		const vsDevCmd = path.join(installPath, 'Common7', 'Tools', 'VsDevCmd.bat');
		return fs.existsSync(vsDevCmd) ? vsDevCmd : null;
	} catch (e) {
		return null;
	}
};

const ensureDir = (dir) => {
	try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { }
};

const isPortInUse = (port, host = '127.0.0.1') => new Promise((resolve) => {
	const socket = new net.Socket();
	const done = (val) => {
		try { socket.destroy(); } catch (e) { }
		resolve(val);
	};
	socket.setTimeout(300);
	socket.once('connect', () => done(true));
	socket.once('timeout', () => done(false));
	socket.once('error', () => done(false));
	socket.connect(port, host);
});

const findFreePort = async (startPort, { host = '127.0.0.1', maxTries = 40 } = {}) => {
	let p = Number(startPort) || 0;
	for (let i = 0; i < maxTries; i++) {
		// eslint-disable-next-line no-await-in-loop
		const used = await isPortInUse(p, host);
		if (!used) return p;
		p += 1;
	}
	return Number(startPort) || 0;
};

const httpJson = (url, { timeoutMs = 600 } = {}) => new Promise((resolve) => {
	try {
		const req = http.get(url, (res) => {
			const chunks = [];
			res.on('data', (d) => chunks.push(d));
			res.on('end', () => {
				try {
					const body = Buffer.concat(chunks).toString('utf8');
					resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: JSON.parse(body) });
				} catch (e) {
					resolve({ ok: false, status: res.statusCode || 0, json: null });
				}
			});
		});
		req.on('error', () => resolve({ ok: false, status: 0, json: null }));
		req.setTimeout(timeoutMs, () => { try { req.destroy(); } catch (e) { } resolve({ ok: false, status: 0, json: null }); });
	} catch (e) {
		resolve({ ok: false, status: 0, json: null });
	}
});

const commandExists = (cmd, env = process.env) => {
	try {
		if (process.platform === 'win32') {
			const r = spawnSync('where', [cmd], { stdio: 'ignore', env });
			return r.status === 0;
		}
		const r = spawnSync('which', [cmd], { stdio: 'ignore', env });
		return r.status === 0;
	} catch (e) {
		return false;
	}
};

const parseArgs = () => {
	const argv = process.argv.slice(2);
	const cmd = (argv[0] || 'web').toLowerCase();
	const get = (name, fallback) => {
		const idx = argv.findIndex(a => a === `--${name}` || a === `-${name[0]}`);
		if (idx === -1) return fallback;
		const v = argv[idx + 1];
		return v ?? fallback;
	};
	const has = (flag) => argv.includes(`--${flag}`);
	return {
		cmd,
		goosePort: Number(get('port', '3000')) || 3000,
		proxyPort: Number(get('proxy-port', '18181')) || 18181,
		model: String(get('model', 'qwen-coder-plus') || 'qwen-coder-plus'),
		open: has('open'),
		window: !has('no-window'),
		forcePort: has('force-port'),
	};
};

const findGooseRoot = () => {
	const candidates = [
		path.join(OPENCODE_ROOT, '_refs', 'goose-block'),
		path.join(OPENCODE_ROOT, '_refs', 'goose'),
		path.join(OPENCODE_ROOT, '_refs', 'goose_block'),
	];
	for (const dir of candidates) {
		try {
			if (!fs.existsSync(dir)) continue;
			if (!fs.existsSync(path.join(dir, 'Cargo.toml'))) continue;
			// goose-cli exists in upstream layouts
			if (fs.existsSync(path.join(dir, 'crates', 'goose-cli'))) return dir;
		} catch (e) { }
	}
	return null;
};

const readState = (p) => {
	try {
		if (!fs.existsSync(p)) return null;
		return JSON.parse(fs.readFileSync(p, 'utf8'));
	} catch (e) {
		return null;
	}
};

const writeState = (p, data) => {
	ensureDir(path.dirname(p));
	fs.writeFileSync(p, JSON.stringify(data, null, 2));
};

const tryKillPid = (pid) => {
	if (!pid || typeof pid !== 'number') return false;
	try {
		process.kill(pid);
		return true;
	} catch (e) {
		return false;
	}
};

const startProxyIfNeeded = async ({ proxyPort }) => {
	let port = Number(proxyPort) || 18181;
	const up = await isPortInUse(port);
	if (up) {
		// If something is already listening, only reuse it if it looks like our proxy.
		const health = await httpJson(`http://127.0.0.1:${port}/health`);
		if (health.ok && health.json?.service === 'qwen-openai-proxy') {
			return { started: false, port };
		}
		port = await findFreePort(port + 1);
	}

	const proxyScript = path.join(OPENCODE_ROOT, 'bin', 'qwen-openai-proxy.mjs');
	const env = withCargoOnPath(process.env);
	const child = spawn(process.execPath, [proxyScript, '--port', String(port)], {
		cwd: OPENCODE_ROOT,
		detached: true,
		stdio: 'ignore',
		env
	});
	child.unref();

	writeState(PROXY_STATE, { pid: child.pid, port, startedAt: new Date().toISOString() });
	return { started: true, port, pid: child.pid };
};

const launchGooseWeb = async ({ goosePort, proxyPort, model, open, window, forcePort = false }) => {
	const gooseRoot = findGooseRoot();
	if (!gooseRoot) throw new Error('Goose repo not found under `_refs/`.');

	const env = withCargoOnPath(process.env);

	const envVars = {
		GOOSE_PROVIDER: 'openai',
		GOOSE_MODEL: model,
		OPENAI_HOST: `http://127.0.0.1:${proxyPort}`,
		OPENAI_BASE_PATH: 'v1/chat/completions',
		OPENAI_API_KEY: 'local',
	};

	let port = Number(goosePort) || 3000;
	const inUse = await isPortInUse(port);
	if (inUse && !forcePort) {
		port = await findFreePort(port + 1);
	}

	const args = ['web', '--port', String(port)];
	if (open) args.push('--open');

	const hasGoose = commandExists('goose', env);
	const hasCargo = commandExists('cargo', env);

	if (!hasGoose && !hasCargo) {
		const hasWinget = commandExists('winget');
		const lines = [
			'Neither `goose` nor `cargo` found on PATH.',
			'',
			'Install Rust toolchain (Cargo) then retry:',
			process.platform === 'win32' && hasWinget
				? '  winget install --id Rustlang.Rustup -e'
				: process.platform === 'win32'
					? '  Install from https://rustup.rs (rustup-init.exe)'
					: '  Install from https://rustup.rs',
			'  rustup default stable',
			'  (restart terminal so PATH updates)',
			'',
			'Then re-run:',
			'  /goose',
			'',
			'Optional: if you already have Goose installed, ensure `goose` is on PATH.'
		];
		throw new Error(lines.join('\n'));
	}

	// Prefer a native goose binary if present.
	let spawnCmd;
	let spawnArgs;
	let spawnCwd = gooseRoot;

	if (hasGoose) {
		spawnCmd = 'goose';
		spawnArgs = args;
	} else {
		// Use Cargo. On Windows, prefer running through VsDevCmd if available to ensure link.exe is configured.
		const vsDevCmd = findVsDevCmd();
		if (process.platform === 'win32' && vsDevCmd) {
			spawnCmd = 'cmd';
			const cargoRun = ['cargo', 'run', '-p', 'goose-cli', '--', ...args].join(' ');
			// Use `call` for .bat files so cmd continues after VsDevCmd sets environment.
			spawnArgs = ['/c', `call \"${vsDevCmd}\" -arch=amd64 -host_arch=amd64 && ${cargoRun}`];
		} else {
			spawnCmd = 'cargo';
			spawnArgs = ['run', '-p', 'goose-cli', '--', ...args];
		}
	}

	// On Windows, open in a new terminal window for a more "app-like" feel.
	if (process.platform === 'win32' && window) {
		const psEnv = Object.entries(envVars)
			.map(([k, v]) => `$env:${k}='${String(v).replace(/'/g, "''")}'`)
			.join('; ');
		const cd = `Set-Location -LiteralPath '${gooseRoot.replace(/'/g, "''")}'`;
		const cmdLine = `${psEnv}; ${cd}; ${spawnCmd} ${spawnArgs.map(a => `'${String(a).replace(/'/g, "''")}'`).join(' ')}`;
		const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-Command',\"${cmdLine.replace(/\"/g, '`\"')}\"`], {
			cwd: OPENCODE_ROOT,
			detached: true,
			stdio: 'ignore',
			env
		});
		child.unref();
		writeState(GOOSE_STATE, { port, proxyPort, model, startedAt: new Date().toISOString(), mode: 'web', window: true });
		return { started: true, port, proxyPort, model, window: true, url: `http://localhost:${port}` };
	}

	// Otherwise, launch detached in background.
	const child = spawn(spawnCmd, spawnArgs, {
		cwd: spawnCwd,
		detached: true,
		stdio: 'ignore',
		env: { ...env, ...envVars }
	});
	child.unref();

	writeState(GOOSE_STATE, { pid: child.pid, port, proxyPort, model, startedAt: new Date().toISOString(), mode: 'web', window: false });
	return { started: true, pid: child.pid, port, proxyPort, model, window: false, url: `http://localhost:${port}` };
};

const launchElectron = async ({ url }) => {
	const appDir = path.join(OPENCODE_ROOT, 'bin', 'goose-electron-app');
	const pkg = path.join(appDir, 'package.json');
	if (!fs.existsSync(pkg)) throw new Error('Electron wrapper missing (bin/goose-electron-app).');

	// Some dev shells set `ELECTRON_RUN_AS_NODE=1` which prevents Electron from opening a GUI.
	// Force GUI mode for Goose.
	const env = { ...process.env, GOOSE_URL: url };
	// Windows env var keys can be different-cased; delete case-insensitively.
	for (const k of Object.keys(env)) {
		if (k.toLowerCase() === 'electron_run_as_node') delete env[k];
	}
	const electronExe = process.platform === 'win32'
		? path.join(appDir, 'node_modules', 'electron', 'dist', 'electron.exe')
		: path.join(appDir, 'node_modules', '.bin', 'electron');
	const electronFallback = process.platform === 'win32'
		? path.join(appDir, 'node_modules', '.bin', 'electron.cmd')
		: null;
	const bin = fs.existsSync(electronExe) ? electronExe : electronFallback;

	// Install electron on-demand (large); keep it scoped to the wrapper dir.
	if (!fs.existsSync(bin)) {
		const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
		const res = spawnSync(npmCmd, ['install', '--silent'], { cwd: appDir, stdio: 'inherit' });
		if (res.status !== 0) throw new Error('Failed to install Electron dependencies (npm install).');
	}

	ensureDir(STATE_DIR);
	fs.appendFileSync(GOOSE_ELECTRON_LOG, `\n\n[${new Date().toISOString()}] Launching Electron UI for Goose at ${url}\n`);
	const logFd = fs.openSync(GOOSE_ELECTRON_LOG, 'a');

	const spawnArgs = fs.existsSync(electronExe) ? [appDir] : ['.'];
	const child = spawn(bin, spawnArgs, {
		cwd: appDir,
		detached: true,
		stdio: ['ignore', logFd, logFd],
		env,
		shell: Boolean(electronFallback && bin === electronFallback),
		// `windowsHide` can sometimes suppress GUI visibility depending on how the parent process is launched.
		// Only hide the console window; keep the app window visible.
		windowsHide: false,
	});
	child.unref();
	try { fs.closeSync(logFd); } catch (e) { }
	return { started: true, pid: child.pid, url, log: GOOSE_ELECTRON_LOG };
};

const main = async () => {
	const args = parseArgs();
	ensureDir(STATE_DIR);

	if (args.cmd === 'status') {
		const proxy = readState(PROXY_STATE);
		const goose = readState(GOOSE_STATE);
		console.log(JSON.stringify({ proxy, goose }, null, 2));
		return;
	}

	if (args.cmd === 'stop') {
		const proxy = readState(PROXY_STATE);
		const goose = readState(GOOSE_STATE);
		const stopped = {
			goose: goose?.pid ? tryKillPid(goose.pid) : false,
			proxy: proxy?.pid ? tryKillPid(proxy.pid) : false,
		};
		try { fs.unlinkSync(GOOSE_STATE); } catch (e) { }
		try { fs.unlinkSync(PROXY_STATE); } catch (e) { }
		console.log(JSON.stringify({ stopped }, null, 2));
		return;
	}

	if (args.cmd !== 'web') {
		if (args.cmd !== 'app') throw new Error(`Unknown command: ${args.cmd} (expected: web|app|status|stop)`);
	}

	const proxy = await startProxyIfNeeded({ proxyPort: args.proxyPort });
	const launched = await launchGooseWeb({
		goosePort: args.goosePort,
		proxyPort: proxy.port,
		model: args.model,
		open: args.cmd === 'web' ? args.open : false,
		window: args.window,
		forcePort: args.forcePort
	});

	let ui = null;
	if (args.cmd === 'app') {
		ui = await launchElectron({ url: launched.url });
	}

	console.log(JSON.stringify({
		ok: true,
		launched: { ...launched, proxyPort: proxy.port },
		ui,
		hints: {
			gooseUrl: launched.url,
			proxyHealth: `http://127.0.0.1:${proxy.port}/health`
		}
	}, null, 2));
};

main().catch((e) => {
	console.error(String(e?.message || e));
	process.exit(1);
});
