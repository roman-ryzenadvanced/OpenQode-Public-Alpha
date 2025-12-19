import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const runCheck = (cmd, args = [], env = process.env) => {
	try {
		const r = spawnSync(cmd, args, { stdio: 'ignore', shell: false, env });
		return r.status === 0;
	} catch (e) {
		return false;
	}
};

const commandExists = (cmd, env = process.env) => {
	if (isWin) return runCheck('where', [cmd], env);
	return runCheck('which', [cmd], env);
};

export const hasWinget = () => isWin && runCheck('winget', ['--version']);
export const hasBrew = () => isMac && runCheck('brew', ['--version']);

export const hasGit = () => runCheck('git', ['--version']);
export const hasRipgrep = () => runCheck('rg', ['--version']);
export const hasVercel = () => runCheck('vercel', ['--version']);

export const hasQwenCli = () => {
	if (!isWin) return runCheck('qwen', ['--version']);
	if (runCheck('qwen.cmd', ['--version'])) return true;
	const appData = process.env.APPDATA || '';
	const cliPath = path.join(appData, 'npm', 'node_modules', '@qwen-code', 'qwen-code', 'cli.js');
	return fs.existsSync(cliPath);
};

export const hasRustup = () => runCheck('rustup', ['--version']);
export const hasCargo = () => runCheck('cargo', ['--version']);

const hasCcToolchain = () => {
	if (isWin) return true; // handled by MSVC build tools check
	// cc is the standard entry; gcc/clang are common.
	return runCheck('cc', ['--version']) || runCheck('gcc', ['--version']) || runCheck('clang', ['--version']);
};

const hasPkgConfig = () => {
	if (isWin) return true;
	return runCheck('pkg-config', ['--version']);
};

const hasXcodeCLT = () => {
	if (!isMac) return true;
	return runCheck('xcode-select', ['-p']);
};

const cargoBinDir = () => {
	const home = process.env.USERPROFILE || process.env.HOME || '';
	if (!home) return null;
	const p = path.join(home, '.cargo', 'bin');
	return fs.existsSync(p) ? p : null;
};

export const envWithCargoOnPath = (env = process.env) => {
	if (!isWin) return { ...env };
	const cargoBin = cargoBinDir();
	if (!cargoBin) return { ...env };
	const current = String(env.PATH || env.Path || '');
	if (current.toLowerCase().includes(cargoBin.toLowerCase())) return { ...env };
	return { ...env, PATH: `${cargoBin};${current}` };
};

const findVsDevCmd = () => {
	if (!isWin) return null;
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

// On Windows, checking `link.exe` on PATH is unreliable (it may only be available via VsDevCmd).
// Treat MSVC as present if VsDevCmd exists (VC tools installed).
export const hasMsvcBuildTools = () => (isWin ? Boolean(findVsDevCmd()) : true);

const detectLinuxPkgManager = () => {
	if (isWin || isMac) return null;
	if (commandExists('apt-get')) return 'apt';
	if (commandExists('dnf')) return 'dnf';
	if (commandExists('yum')) return 'yum';
	if (commandExists('pacman')) return 'pacman';
	if (commandExists('zypper')) return 'zypper';
	return null;
};

const buildInstallPlan = (items, kind) => {
	return (items || [])
		.filter(i => i.kind === kind && !i.ok)
		.map(i => i.install)
		.filter(Boolean);
};

export function detectPrereqs() {
	const winget = hasWinget();
	const brew = hasBrew();
	const linuxPm = detectLinuxPkgManager();

	const baseline = [
		{ id: 'qwen', label: 'Qwen CLI (AI)', ok: hasQwenCli(), kind: 'baseline' },
		{ id: 'git', label: 'Git (NanoDev/worktrees)', ok: hasGit(), kind: 'baseline' },
		{ id: 'rg', label: 'Ripgrep (fast search)', ok: hasRipgrep(), kind: 'baseline' },
	];

	const optional = [
		{ id: 'vercel', label: 'Vercel CLI (deploy)', ok: hasVercel(), kind: 'optional' },
	];

	const goose = [
		{ id: 'rustup', label: 'Rustup (Rust toolchain manager)', ok: hasRustup(), kind: 'goose' },
		{ id: 'cargo', label: 'Cargo (build Goose)', ok: hasCargo(), kind: 'goose' },
		...(isWin ? [{ id: 'msvc', label: 'MSVC Build Tools (C++ toolchain)', ok: hasMsvcBuildTools(), kind: 'goose' }] : []),
		...(!isWin ? [{ id: 'cc', label: 'C toolchain (cc/gcc/clang)', ok: hasCcToolchain(), kind: 'goose' }] : []),
		...(!isWin ? [{ id: 'pkgconfig', label: 'pkg-config (native deps)', ok: hasPkgConfig(), kind: 'goose' }] : []),
		...(isMac ? [{ id: 'xcode', label: 'Xcode Command Line Tools', ok: hasXcodeCLT(), kind: 'goose' }] : []),
	];

	// Attach per-platform install tokens
	const withInstall = (item) => {
		if (item.ok) return { ...item, install: null };

		// Windows
		if (isWin) {
			if (item.id === 'git' && winget) return { ...item, install: 'winget-git' };
			if (item.id === 'rg' && winget) return { ...item, install: 'winget-rg' };
			if (item.id === 'qwen') return { ...item, install: winget ? 'winget-qwen' : 'npm-qwen' };
			if (item.id === 'vercel') return { ...item, install: 'npm-vercel' };
			if (item.id === 'rustup' && winget) return { ...item, install: 'winget-rustup' };
			if (item.id === 'msvc' && winget) return { ...item, install: 'winget-vsbuildtools' };
			return { ...item, install: null };
		}

		// macOS (Homebrew)
		if (isMac) {
			if (!brew) return { ...item, install: null, note: 'Install Homebrew first' };
			if (item.id === 'git') return { ...item, install: 'brew-git' };
			if (item.id === 'rg') return { ...item, install: 'brew-rg' };
			if (item.id === 'cc' || item.id === 'xcode') return { ...item, install: 'mac-xcode-clt' };
			if (item.id === 'pkgconfig') return { ...item, install: 'brew-pkg-config' };
			if (item.id === 'vercel') return { ...item, install: 'npm-vercel' };
			if (item.id === 'qwen') return { ...item, install: 'npm-qwen' };
			if (item.id === 'rustup') return { ...item, install: 'rustup-install' };
			return { ...item, install: null };
		}

		// Linux (system pkg manager)
		if (linuxPm) {
			if (item.id === 'git') return { ...item, install: `linux-${linuxPm}-git` };
			if (item.id === 'rg') return { ...item, install: `linux-${linuxPm}-rg` };
			if (item.id === 'cc') return { ...item, install: `linux-${linuxPm}-build` };
			if (item.id === 'pkgconfig') return { ...item, install: `linux-${linuxPm}-pkgconfig` };
			if (item.id === 'vercel') return { ...item, install: 'npm-vercel' };
			if (item.id === 'qwen') return { ...item, install: 'npm-qwen' };
			if (item.id === 'rustup') return { ...item, install: 'rustup-install' };
		}

		return { ...item, install: null };
	};

	const items = [...baseline, ...optional, ...goose].map(withInstall);
	const missingBaseline = items.filter(i => i.kind === 'baseline' && !i.ok);
	const missingGoose = items.filter(i => i.kind === 'goose' && !i.ok);

	return {
		platform: process.platform,
		winget,
		brew,
		linuxPackageManager: linuxPm,
		items,
		missingBaseline,
		missingGoose,
		baselinePlan: buildInstallPlan(items, 'baseline'),
		goosePlan: buildInstallPlan(items, 'goose'),
		optionalPlan: buildInstallPlan(items, 'optional'),
	};
}

const normalizeProgressOutput = (text) => {
	let out = String(text || '');

	// Convert cursor-position updates commonly used by winget/progress bars into line boundaries.
	// Example sequences:
	// - ESC[0G (move cursor to column 0)
	// - ESC[G
	// - ESC[2K (clear line)
	out = out.replace(/\u001b\[[0-9;]*G/g, '\n');
	out = out.replace(/\u001b\[[0-9;]*K/g, '');

	// Treat carriage returns as "new line" boundaries (best-effort log view).
	out = out.replace(/\r/g, '\n');

	// Strip remaining ANSI control sequences to avoid weird artifacts in TUI log.
	out = out.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
	out = out.replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, '');

	// Remove backspaces (rare but can appear in progress updates)
	out = out.replace(/\u0008+/g, '');

	return out;
};

const streamLines = (chunk, carry, onLine) => {
	const text = normalizeProgressOutput(carry + chunk);
	const parts = text.split('\n');
	const nextCarry = parts.pop() ?? '';
	for (const p of parts) {
		const line = p.trim();
		if (line.length) onLine(line);
	}
	return nextCarry;
};

const execStreaming = (command, opts = {}, onLine = () => { }) => new Promise((resolve) => {
	const child = spawn(command, {
		cwd: opts.cwd || process.cwd(),
		shell: true,
		env: opts.env || process.env,
	});

	let carry = '';
	let out = '';

	const onData = (d) => {
		const s = d.toString();
		out += s;
		carry = streamLines(s, carry, onLine);
	};

	child.stdout.on('data', onData);
	child.stderr.on('data', onData);
	child.on('close', (code) => {
		if (carry.trim()) onLine(carry.trimEnd());
		resolve({ success: code === 0, code: code || 0, output: out.trim() });
	});
	child.on('error', (e) => resolve({ success: false, code: 1, output: String(e?.message || e) }));
});

export function buildInstallSteps(installTokens) {
	const tokens = Array.isArray(installTokens) ? installTokens.filter(Boolean) : [];
	const steps = [];

	const add = (id, label, command, options = {}) => {
		steps.push({ id, label, command, ...options });
	};

	const linuxPm = detectLinuxPkgManager();

	for (const t of tokens) {
		if (t === 'winget-git') add('git', 'Install Git', 'winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements', { interactive: false });
		else if (t === 'winget-rg') add('rg', 'Install Ripgrep', 'winget install --id BurntSushi.ripgrep.MSVC -e --accept-source-agreements --accept-package-agreements', { interactive: false });
		else if (t === 'winget-rustup') {
			add('rustup', 'Install Rustup', 'winget install --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements', { interactive: false });
			add('rustup-default', 'Set Rust stable', 'rustup default stable', { interactive: false, envPatch: 'cargo' });
		}
		else if (t === 'winget-vsbuildtools') add('vsbuildtools', 'Install MSVC Build Tools (C++)', 'winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-source-agreements --accept-package-agreements --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"', { interactive: true });
		else if (t === 'winget-qwen') add('qwen', 'Install Qwen CLI (npm)', 'npm install -g @qwen-code/qwen-code', { interactive: false });
		else if (t === 'npm-qwen') add('qwen', 'Install Qwen CLI (npm)', 'npm install -g @qwen-code/qwen-code', { interactive: false });
		else if (t === 'npm-vercel') add('vercel', 'Install Vercel CLI (npm)', 'npm install -g vercel', { interactive: false });
		else if (t === 'brew-git') add('git', 'Install Git (brew)', 'brew install git', { interactive: true });
		else if (t === 'brew-rg') add('rg', 'Install Ripgrep (brew)', 'brew install ripgrep', { interactive: true });
		else if (t === 'brew-pkg-config') add('pkg-config', 'Install pkg-config (brew)', 'brew install pkg-config', { interactive: true });
		else if (t === 'mac-xcode-clt') add('xcode-clt', 'Install Xcode Command Line Tools', 'xcode-select --install', { interactive: true });
		else if (t === 'rustup-install') add('rustup', 'Install Rustup', 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y', { interactive: true });
		else if (t.startsWith('linux-') && linuxPm) {
			const wantGit = t.endsWith('-git');
			const wantRg = t.endsWith('-rg');
			const wantBuild = t.endsWith('-build');
			const wantPkg = t.endsWith('-pkgconfig');

			if (linuxPm === 'apt') {
				if (wantGit) add('git', 'Install git (apt)', 'sudo apt-get update && sudo apt-get install -y git', { interactive: true });
				if (wantRg) add('ripgrep', 'Install ripgrep (apt)', 'sudo apt-get update && sudo apt-get install -y ripgrep', { interactive: true });
				if (wantBuild) add('build-essential', 'Install build-essential (apt)', 'sudo apt-get update && sudo apt-get install -y build-essential', { interactive: true });
				if (wantPkg) add('pkg-config', 'Install pkg-config + ssl dev (apt)', 'sudo apt-get update && sudo apt-get install -y pkg-config libssl-dev', { interactive: true });
			} else if (linuxPm === 'dnf') {
				if (wantGit) add('git', 'Install git (dnf)', 'sudo dnf install -y git', { interactive: true });
				if (wantRg) add('ripgrep', 'Install ripgrep (dnf)', 'sudo dnf install -y ripgrep', { interactive: true });
				if (wantBuild) add('build', 'Install C toolchain (dnf)', 'sudo dnf install -y gcc gcc-c++ make', { interactive: true });
				if (wantPkg) add('pkg-config', 'Install pkgconf + openssl-devel (dnf)', 'sudo dnf install -y pkgconf-pkg-config openssl-devel', { interactive: true });
			} else if (linuxPm === 'yum') {
				if (wantGit) add('git', 'Install git (yum)', 'sudo yum install -y git', { interactive: true });
				if (wantRg) add('ripgrep', 'Install ripgrep (yum)', 'sudo yum install -y ripgrep', { interactive: true });
				if (wantBuild) add('build', 'Install C toolchain (yum)', 'sudo yum install -y gcc gcc-c++ make', { interactive: true });
				if (wantPkg) add('pkg-config', 'Install pkgconfig + openssl-devel (yum)', 'sudo yum install -y pkgconfig openssl-devel', { interactive: true });
			} else if (linuxPm === 'pacman') {
				if (wantGit) add('git', 'Install git (pacman)', 'sudo pacman -Sy --noconfirm git', { interactive: true });
				if (wantRg) add('ripgrep', 'Install ripgrep (pacman)', 'sudo pacman -Sy --noconfirm ripgrep', { interactive: true });
				if (wantBuild) add('base-devel', 'Install base-devel (pacman)', 'sudo pacman -Sy --noconfirm base-devel', { interactive: true });
				if (wantPkg) add('pkg-config', 'Install pkgconf + openssl (pacman)', 'sudo pacman -Sy --noconfirm pkgconf openssl', { interactive: true });
			} else if (linuxPm === 'zypper') {
				if (wantGit) add('git', 'Install git (zypper)', 'sudo zypper --non-interactive install git', { interactive: true });
				if (wantRg) add('ripgrep', 'Install ripgrep (zypper)', 'sudo zypper --non-interactive install ripgrep', { interactive: true });
				if (wantBuild) add('build', 'Install gcc/make (zypper)', 'sudo zypper --non-interactive install gcc gcc-c++ make', { interactive: true });
				if (wantPkg) add('pkg-config', 'Install pkg-config + libopenssl-devel (zypper)', 'sudo zypper --non-interactive install pkg-config libopenssl-devel', { interactive: true });
			}
		}
	}

	// Dedupe by command to avoid repeating (keep order)
	const seen = new Set();
	return steps.filter(s => {
		const key = `${s.command}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export async function installPrereqs(installTokens, opts = {}) {
	const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => { };
	const envBase = opts.env || process.env;
	const env = envWithCargoOnPath(envBase);

	const steps = buildInstallSteps(installTokens);
	const results = [];

	for (const step of steps) {
		onEvent({ type: 'step', state: 'start', step });

		const stepEnv = step.envPatch === 'cargo' ? envWithCargoOnPath(env) : env;
		// Always stream so the TUI can show progress; interactive steps may require the user to respond (UAC/sudo).
		// eslint-disable-next-line no-await-in-loop
		const res = await execStreaming(step.command, { env: stepEnv }, (line) => onEvent({ type: 'data', step, line }));

		const entry = { ...step, ...res };
		results.push(entry);
		onEvent({ type: 'step', state: 'end', step, result: entry });
		if (!res.success) break;
	}

	return results;
}

// Backward-compatible exports (used by existing wiring)
export function detectWindowsPrereqs() {
	return detectPrereqs();
}

export function installWindowsPrereqs(plan, onLog = () => { }) {
	return installPrereqs(plan, {
		onEvent: (ev) => {
			if (ev.type === 'step' && ev.state === 'start') onLog(`==> ${ev.step.label}`);
			if (ev.type === 'data') onLog(ev.line);
			if (ev.type === 'step' && ev.state === 'end') onLog(ev.result?.success ? '✓ done' : `x failed (${ev.result?.code || 1})`);
		}
	});
}
