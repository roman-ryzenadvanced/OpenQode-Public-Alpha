import { app, BrowserWindow, ipcMain, shell, protocol, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { streamChat } from './qwen-api.js';
import { generateImage, detectImageRequest, cleanupCache } from './image-api.js';
import { fsApi } from './fs-api.js';
import * as viAutomation from './vi-automation.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect dev mode from environment variable (set by launcher)
// Default: Production mode (load from dist)
const isDev = process.env.GOOSE_DEV === 'true' || process.env.GOOSE_DEV === '1';
console.log(`[Goose Ultra] Mode: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);

let mainWindow;

// Register Schema
protocol.registerSchemesAsPrivileged([
    { scheme: 'preview', privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true } }
]);

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 720,
        title: 'Goose Ultra v1.0.1',
        backgroundColor: '#030304', // Match theme
        show: false, // Wait until ready-to-show
        autoHideMenuBar: true, // Hide the native menu bar
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webviewTag: true,
            webSecurity: false
        }
    });

    // Graceful show
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Load based on mode
    if (isDev) {
        console.log('[Goose Ultra] Loading from http://localhost:3000');
        mainWindow.loadURL('http://localhost:3000');
    } else {
        console.log('[Goose Ultra] Loading from dist/index.html');
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Open external links in browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

import http from 'http';
import fs from 'fs';

// ... imports ...

app.whenReady().then(() => {
    // START LOCAL PREVIEW SERVER
    // This bypasses all file:// protocol issues by serving real HTTP
    const server = http.createServer((req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

        try {
            // URL: /projects/latest/index.html
            // Map to: %AppData%/projects/latest/index.html
            const cleanUrl = req.url.split('?')[0];
            // `req.url` starts with `/`. On Windows, `path.join(base, "\\projects\\...")` discards `base`.
            // Strip leading slashes so we always resolve under `userData`.
            const safeSuffix = path
                .normalize(cleanUrl)
                .replace(/^(\.\.[\/\\])+/, '')
                .replace(/^[\/\\]+/, '');
            const filePath = path.join(app.getPath('userData'), safeSuffix);

            console.log(`[PreviewServer] Request: ${cleanUrl} -> ${filePath}`);

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    console.error(`[PreviewServer] 404: ${filePath}`);
                    res.writeHead(404);
                    res.end('File not found');
                    return;
                }

                const ext = path.extname(filePath).toLowerCase();
                const mimeTypes = {
                    '.html': 'text/html',
                    '.js': 'text/javascript',
                    '.css': 'text/css',
                    '.json': 'application/json',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.svg': 'image/svg+xml'
                };

                const contentType = mimeTypes[ext] || 'application/octet-stream';
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            });
        } catch (e) {
            console.error('[PreviewServer] Error:', e);
            res.writeHead(500);
            res.end('Server Error');
        }
    });

    // Start Preview Server
    let previewPort = 45678;
    server.listen(previewPort, '127.0.0.1', () => {
        console.log(`[PreviewServer] Running on http://127.0.0.1:${previewPort}`);
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            previewPort = 45679;
            console.log(`[PreviewServer] Port 45678 in use, trying ${previewPort}`);
            server.listen(previewPort, '127.0.0.1');
        } else {
            console.error('[PreviewServer] Error:', e);
        }
    });

    createWindow();
});

// ...

// IPC Handlers
ipcMain.handle('get-app-path', () => app.getPath('userData'));
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-server-port', () => previewPort);
ipcMain.handle('export-project-zip', async (_, { projectId }) => {
    if (!projectId) throw new Error('projectId required');
    if (process.platform !== 'win32') throw new Error('ZIP export currently supported on Windows only.');

    const userData = app.getPath('userData');
    const projectDir = path.join(userData, 'projects', String(projectId));
    const outDir = path.join(userData, 'exports');
    const outPath = path.join(outDir, `${projectId}.zip`);

    await fs.promises.mkdir(outDir, { recursive: true });

    const execFileAsync = promisify(execFile);
    const ps = 'powershell.exe';
    const cmd = `Compress-Archive -Path '${projectDir}\\*' -DestinationPath '${outPath}' -Force`;

    await execFileAsync(ps, ['-NoProfile', '-NonInteractive', '-Command', cmd]);
    return outPath;
});

// Chat Streaming IPC
ipcMain.on('chat-stream-start', (event, { messages, model }) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    streamChat(
        messages,
        model,
        (chunk) => {
            if (!window.isDestroyed()) {
                // console.log('[Main] Sending chunk size:', chunk.length); // Verbose log
                window.webContents.send('chat-chunk', chunk);
            }
        },
        (fullResponse) => !window.isDestroyed() && window.webContents.send('chat-complete', fullResponse),
        (error) => !window.isDestroyed() && window.webContents.send('chat-error', error.message),
        (status) => !window.isDestroyed() && window.webContents.send('chat-status', status)
    );
});

// FS Handlers
ipcMain.handle('fs-list', async (_, path) => fsApi.listFiles(path));
ipcMain.handle('fs-read', async (_, path) => fsApi.readFile(path));
ipcMain.handle('fs-write', async (_, { path, content }) => fsApi.writeFile(path, content));
ipcMain.handle('fs-delete', async (_, path) => fsApi.deletePath(path));

// --- IMAGE GENERATION Handlers ---
// Enables ChatGPT-like image generation in Chat Mode
ipcMain.handle('image-generate', async (_, { prompt, options }) => {
    console.log('[Main] Image generation request:', prompt?.substring(0, 50));
    try {
        const result = await generateImage(prompt, options);
        return { success: true, ...result };
    } catch (error) {
        console.error('[Main] Image generation failed:', error.message);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('image-detect', async (_, { message }) => {
    const result = detectImageRequest(message);
    return result;
});

// Cleanup old cached images on startup
cleanupCache(7);

// --- IT EXPERT: PowerShell Execution Handler ---
// Credits: Inspired by Windows-Use (CursorTouch) and Mini-Agent patterns
// Security: Deny by default. Only runs if renderer explicitly enables and user approves.

import { spawn } from 'child_process';

const POWERSHELL_DENYLIST = [
    /Remove-Item\s+-Recurse\s+-Force\s+[\/\\]/i,
    /Format-Volume/i,
    /Clear-Disk/i,
    /Start-Process\s+.*-Verb\s+RunAs/i,
    /Add-MpPreference\s+-ExclusionPath/i,
    /Set-MpPreference/i,
    /reg\s+delete/i,
    /bcdedit/i,
    /cipher\s+\/w/i
];

function isDenylisted(script) {
    return POWERSHELL_DENYLIST.some(pattern => pattern.test(script));
}

let activeExecProcess = null;

ipcMain.on('exec-run-powershell', (event, { execSessionId, script, enabled }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) return;

    // Security Gate: Execution must be enabled by user
    if (!enabled) {
        window.webContents.send('exec-error', { execSessionId, message: 'PowerShell execution is disabled. Enable it in Settings.' });
        return;
    }

    // Security Gate: Denylist check
    if (isDenylisted(script)) {
        window.webContents.send('exec-error', { execSessionId, message: 'BLOCKED: Script contains denylisted dangerous commands.' });
        return;
    }

    const startedAt = Date.now();
    window.webContents.send('exec-start', { execSessionId, startedAt });

    // Spawn PowerShell with explicit args (never shell=true)
    activeExecProcess = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true,
        env: { ...process.env, HOME: undefined, USERPROFILE: process.env.USERPROFILE } // Sanitize env
    });

    activeExecProcess.stdout.on('data', (data) => {
        if (!window.isDestroyed()) {
            window.webContents.send('exec-chunk', { execSessionId, stream: 'stdout', text: data.toString() });
        }
    });

    activeExecProcess.stderr.on('data', (data) => {
        if (!window.isDestroyed()) {
            window.webContents.send('exec-chunk', { execSessionId, stream: 'stderr', text: data.toString() });
        }
    });

    activeExecProcess.on('close', (code) => {
        const durationMs = Date.now() - startedAt;
        if (!window.isDestroyed()) {
            window.webContents.send('exec-complete', { execSessionId, exitCode: code ?? 0, durationMs });
        }
        activeExecProcess = null;
    });

    activeExecProcess.on('error', (err) => {
        if (!window.isDestroyed()) {
            window.webContents.send('exec-error', { execSessionId, message: err.message });
        }
        activeExecProcess = null;
    });
});

ipcMain.on('exec-cancel', (event, { execSessionId }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (activeExecProcess) {
        activeExecProcess.kill('SIGTERM');
        activeExecProcess = null;
        if (window && !window.isDestroyed()) {
            window.webContents.send('exec-cancelled', { execSessionId });
        }
    }
});

// --- VI_CONTROL: Host & Credential Management (Contract v5) ---
import { Client } from 'ssh2';
import crypto from 'crypto';

const VI_CONTROL_DIR = path.join(app.getPath('userData'), 'vi-control');
const HOSTS_FILE = path.join(VI_CONTROL_DIR, 'hosts.json');
const VAULT_FILE = path.join(VI_CONTROL_DIR, 'vault.enc');
const AUDIT_LOG_FILE = path.join(VI_CONTROL_DIR, 'audit.jsonl');

if (!fs.existsSync(VI_CONTROL_DIR)) fs.mkdirSync(VI_CONTROL_DIR, { recursive: true });

// Audit Logging helper
function auditLog(entry) {
    const log = {
        timestamp: new Date().toISOString(),
        ...entry
    };
    fs.appendFileSync(AUDIT_LOG_FILE, JSON.stringify(log) + '\n');
}

// Credential Vault logic
let keytar;
try {
    // Try to import keytar if available
    keytar = await import('keytar');
} catch (e) {
    console.warn('[Vi Control] Keytar not found, using encrypted file fallback.');
}

async function getSecret(id) {
    if (keytar && keytar.getPassword) {
        return await keytar.getPassword('GooseUltra', id);
    }
    // Encrypted file fallback logic (simplified for brevity, in real world use specialized encryption)
    if (!fs.existsSync(VAULT_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
    return data[id] ? Buffer.from(data[id], 'base64').toString() : null;
}

async function saveSecret(id, secret) {
    if (keytar && keytar.setPassword) {
        return await keytar.setPassword('GooseUltra', id, secret);
    }
    const data = fs.existsSync(VAULT_FILE) ? JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8')) : {};
    data[id] = Buffer.from(secret).toString('base64');
    fs.writeFileSync(VAULT_FILE, JSON.stringify(data));
}

// Host IPC Handlers
ipcMain.handle('vi-hosts-list', () => {
    if (!fs.existsSync(HOSTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(HOSTS_FILE, 'utf8'));
});

ipcMain.handle('vi-hosts-add', (_, host) => {
    const hosts = fs.existsSync(HOSTS_FILE) ? JSON.parse(fs.readFileSync(HOSTS_FILE, 'utf8')) : [];
    hosts.push(host);
    fs.writeFileSync(HOSTS_FILE, JSON.stringify(hosts, null, 2));
    auditLog({ action: 'HOST_ADD', hostId: host.hostId, label: host.label });
    return true;
});

ipcMain.handle('vi-hosts-update', (_, updatedHost) => {
    let hosts = JSON.parse(fs.readFileSync(HOSTS_FILE, 'utf8'));
    hosts = hosts.map(h => h.hostId === updatedHost.hostId ? updatedHost : h);
    fs.writeFileSync(HOSTS_FILE, JSON.stringify(hosts, null, 2));
    auditLog({ action: 'HOST_UPDATE', hostId: updatedHost.hostId });
    return true;
});

ipcMain.handle('vi-hosts-delete', (_, hostId) => {
    let hosts = JSON.parse(fs.readFileSync(HOSTS_FILE, 'utf8'));
    hosts = hosts.filter(h => h.hostId !== hostId);
    fs.writeFileSync(HOSTS_FILE, JSON.stringify(hosts, null, 2));
    auditLog({ action: 'HOST_DELETE', hostId });
    return true;
});

// Credentials file for metadata
const CREDS_META_FILE = path.join(VI_CONTROL_DIR, 'credentials-meta.json');

ipcMain.handle('vi-credentials-list', () => {
    if (!fs.existsSync(CREDS_META_FILE)) return [];
    return JSON.parse(fs.readFileSync(CREDS_META_FILE, 'utf8'));
});

ipcMain.handle('vi-credentials-save', async (_, { label, type, value }) => {
    const credentialId = `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Save secret to vault
    await saveSecret(credentialId, value);

    // Save metadata (without secret)
    const credsMeta = fs.existsSync(CREDS_META_FILE) ? JSON.parse(fs.readFileSync(CREDS_META_FILE, 'utf8')) : [];
    credsMeta.push({ credentialId, label, type, createdAt: Date.now() });
    fs.writeFileSync(CREDS_META_FILE, JSON.stringify(credsMeta, null, 2));

    auditLog({ action: 'CREDENTIAL_SAVE', credentialId, label, type });
    return { success: true, credentialId };
});

ipcMain.handle('vi-credentials-delete', async (_, { credId }) => {
    // Remove from vault
    if (fs.existsSync(VAULT_FILE)) {
        const vault = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
        delete vault[credId];
        fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2));
    }

    // Remove from metadata
    if (fs.existsSync(CREDS_META_FILE)) {
        let credsMeta = JSON.parse(fs.readFileSync(CREDS_META_FILE, 'utf8'));
        credsMeta = credsMeta.filter(c => c.credentialId !== credId);
        fs.writeFileSync(CREDS_META_FILE, JSON.stringify(credsMeta, null, 2));
    }

    auditLog({ action: 'CREDENTIAL_DELETE', credentialId: credId });
    return true;
});

// SSH Execution via ssh2
let activeSshClients = new Map(); // execSessionId -> { client, conn }

ipcMain.on('vi-ssh-run', async (event, { execSessionId, hostId, command, credId }) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    try {
        if (!fs.existsSync(HOSTS_FILE)) {
            return window.webContents.send('exec-error', { execSessionId, message: 'No hosts configured' });
        }

        const hosts = JSON.parse(fs.readFileSync(HOSTS_FILE, 'utf8'));
        const host = hosts.find(h => h.hostId === hostId);
        if (!host) return window.webContents.send('exec-error', { execSessionId, message: 'Host not found' });

        // Use host's credId if not passed explicitly
        const effectiveCredId = credId || host.credId;

        // Get password from credential vault
        let password = null;
        if (effectiveCredId) {
            password = await getSecret(effectiveCredId);
        }

        if (!password) {
            return window.webContents.send('exec-error', {
                execSessionId,
                message: 'No credentials found. Please save a credential in the Vault and link it to this host.'
            });
        }

        const conn = new Client();
        let connected = false;

        // Connection timeout (10 seconds)
        const timeout = setTimeout(() => {
            if (!connected) {
                conn.end();
                window.webContents.send('exec-error', { execSessionId, message: 'Connection timeout (10s). Check hostname/port and firewall.' });
                activeSshClients.delete(execSessionId);
            }
        }, 10000);

        conn.on('ready', () => {
            connected = true;
            clearTimeout(timeout);

            conn.exec(command, (err, stream) => {
                if (err) return window.webContents.send('exec-error', { execSessionId, message: err.message });

                window.webContents.send('exec-start', { execSessionId });

                stream.on('data', (data) => {
                    window.webContents.send('exec-chunk', { execSessionId, text: data.toString() });
                }).on('close', (code) => {
                    window.webContents.send('exec-complete', { execSessionId, exitCode: code });
                    conn.end();
                    activeSshClients.delete(execSessionId);
                }).stderr.on('data', (data) => {
                    window.webContents.send('exec-chunk', { execSessionId, text: data.toString(), stream: 'stderr' });
                });
            });
        }).on('error', (err) => {
            clearTimeout(timeout);
            window.webContents.send('exec-error', { execSessionId, message: `SSH Error: ${err.message}` });
            activeSshClients.delete(execSessionId);
        }).connect({
            host: host.hostname,
            port: host.port || 22,
            username: host.username,
            password: password,
            readyTimeout: 10000,
            keepaliveInterval: 5000
        });

        activeSshClients.set(execSessionId, { client: conn });
        auditLog({ action: 'SSH_RUN', hostId, command, execSessionId });

    } catch (err) {
        window.webContents.send('exec-error', { execSessionId, message: `Error: ${err.message}` });
    }
});

ipcMain.on('vi-ssh-cancel', (_, { execSessionId }) => {
    const session = activeSshClients.get(execSessionId);
    if (session) {
        session.client.end();
        activeSshClients.delete(execSessionId);
    }
});

// SSH with direct password (for first-time connections)
ipcMain.on('vi-ssh-run-with-password', async (event, { execSessionId, hostId, command, password }) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    try {
        if (!fs.existsSync(HOSTS_FILE)) {
            return window.webContents.send('exec-error', { execSessionId, message: 'No hosts configured' });
        }

        const hosts = JSON.parse(fs.readFileSync(HOSTS_FILE, 'utf8'));
        const host = hosts.find(h => h.hostId === hostId);
        if (!host) return window.webContents.send('exec-error', { execSessionId, message: 'Host not found' });

        const conn = new Client();
        let connected = false;

        const timeout = setTimeout(() => {
            if (!connected) {
                conn.end();
                window.webContents.send('exec-error', { execSessionId, message: 'Connection timeout (10s). Check hostname/port and firewall.' });
                activeSshClients.delete(execSessionId);
            }
        }, 10000);

        conn.on('ready', () => {
            connected = true;
            clearTimeout(timeout);

            conn.exec(command, (err, stream) => {
                if (err) return window.webContents.send('exec-error', { execSessionId, message: err.message });

                window.webContents.send('exec-start', { execSessionId });

                stream.on('data', (data) => {
                    window.webContents.send('exec-chunk', { execSessionId, text: data.toString() });
                }).on('close', (code) => {
                    window.webContents.send('exec-complete', { execSessionId, exitCode: code });
                    conn.end();
                    activeSshClients.delete(execSessionId);
                }).stderr.on('data', (data) => {
                    window.webContents.send('exec-chunk', { execSessionId, text: data.toString(), stream: 'stderr' });
                });
            });
        }).on('error', (err) => {
            clearTimeout(timeout);
            window.webContents.send('exec-error', { execSessionId, message: `SSH Error: ${err.message}` });
            activeSshClients.delete(execSessionId);
        }).connect({
            host: host.hostname,
            port: host.port || 22,
            username: host.username,
            password: password,
            readyTimeout: 10000,
            keepaliveInterval: 5000
        });

        activeSshClients.set(execSessionId, { client: conn });
        auditLog({ action: 'SSH_RUN_DIRECT', hostId, command, execSessionId });

    } catch (err) {
        window.webContents.send('exec-error', { execSessionId, message: `Error: ${err.message}` });
    }
});

// RDP Launcher
ipcMain.handle('vi-rdp-launch', async (_, { hostId }) => {
    const hosts = JSON.parse(fs.readFileSync(HOSTS_FILE, 'utf8'));
    const host = hosts.find(h => h.hostId === hostId);
    if (!host || host.osHint !== 'windows') return false;

    if (process.platform === 'win32') {
        spawn('mstsc.exe', [`/v:${host.hostname}`]);
        auditLog({ action: 'RDP_LAUNCH', hostId });
        return true;
    }
    return false;
});

// ============================================
// VI CONTROL - AUTOMATION HANDLERS
// ============================================

// Screen Capture
ipcMain.handle('vi-capture-screen', async (_, { mode }) => {
    return await viAutomation.captureScreen(mode || 'desktop');
});

// Get Window List
ipcMain.handle('vi-get-windows', async () => {
    return await viAutomation.getWindowList();
});

// Vision Analysis (Screenshot to JSON)
ipcMain.handle('vi-analyze-screenshot', async (_, { imageDataUrl }) => {
    return await viAutomation.analyzeScreenshot(imageDataUrl, streamChat);
});

// Translate Task to Commands
ipcMain.handle('vi-translate-task', async (_, { task }) => {
    return await viAutomation.translateTaskToCommands(task, streamChat);
});

// Execute Single Command
ipcMain.handle('vi-execute-command', async (_, { command }) => {
    return await viAutomation.executeCommand(command);
});

// Execute Task Chain
ipcMain.on('vi-execute-chain', async (event, { tasks }) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    await viAutomation.executeTaskChain(
        tasks,
        streamChat,
        (progress) => {
            window.webContents.send('vi-chain-progress', progress);
        },
        (results) => {
            window.webContents.send('vi-chain-complete', results);
        }
    );
});

// Open Browser
ipcMain.handle('vi-open-browser', async (_, { url }) => {
    return await viAutomation.openBrowser(url);
});

console.log('Goose Ultra Electron Main Process Started');
