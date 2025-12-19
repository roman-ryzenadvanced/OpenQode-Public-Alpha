const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    getAppPath: () => ipcRenderer.invoke('get-app-path'),
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getServerPort: () => ipcRenderer.invoke('get-server-port'),
    exportProjectZip: (projectId) => ipcRenderer.invoke('export-project-zip', { projectId }),
    // Chat Bridge
    startChat: (messages, model) => ipcRenderer.send('chat-stream-start', { messages, model }),
    onChatChunk: (callback) => ipcRenderer.on('chat-chunk', (_, chunk) => callback(chunk)),
    onChatStatus: (callback) => ipcRenderer.on('chat-status', (_, status) => callback(status)),
    onChatComplete: (callback) => ipcRenderer.on('chat-complete', (_, response) => callback(response)),
    onChatError: (callback) => ipcRenderer.on('chat-error', (_, error) => callback(error)),
    removeChatListeners: () => {
        ipcRenderer.removeAllListeners('chat-chunk');
        ipcRenderer.removeAllListeners('chat-status');
        ipcRenderer.removeAllListeners('chat-complete');
        ipcRenderer.removeAllListeners('chat-error');
    },
    // Filesystem
    fs: {
        list: (path) => ipcRenderer.invoke('fs-list', path),
        read: (path) => ipcRenderer.invoke('fs-read', path),
        write: (path, content) => ipcRenderer.invoke('fs-write', { path, content }),
        delete: (path) => ipcRenderer.invoke('fs-delete', path)
    },
    // Image Generation (ChatGPT-like)
    image: {
        generate: (prompt, options) => ipcRenderer.invoke('image-generate', { prompt, options }),
        detect: (message) => ipcRenderer.invoke('image-detect', { message })
    },
    // IT Expert Execution Bridge
    runPowerShell: (execSessionId, script, enabled) => ipcRenderer.send('exec-run-powershell', { execSessionId, script, enabled }),
    cancelExecution: (execSessionId) => ipcRenderer.send('exec-cancel', { execSessionId }),
    onExecStart: (callback) => ipcRenderer.on('exec-start', (_, data) => callback(data)),
    onExecChunk: (callback) => ipcRenderer.on('exec-chunk', (_, data) => callback(data)),
    onExecComplete: (callback) => ipcRenderer.on('exec-complete', (_, data) => callback(data)),
    onExecError: (callback) => ipcRenderer.on('exec-error', (_, data) => callback(data)),
    onExecCancelled: (callback) => ipcRenderer.on('exec-cancelled', (_, data) => callback(data)),
    removeExecListeners: () => {
        ipcRenderer.removeAllListeners('exec-start');
        ipcRenderer.removeAllListeners('exec-chunk');
        ipcRenderer.removeAllListeners('exec-complete');
        ipcRenderer.removeAllListeners('exec-error');
        ipcRenderer.removeAllListeners('exec-cancelled');
    },
    // VI CONTROL (Contract v6 - Complete Automation)
    vi: {
        // Hosts
        getHosts: () => ipcRenderer.invoke('vi-hosts-list'),
        addHost: (host) => ipcRenderer.invoke('vi-hosts-add', host),
        updateHost: (host) => ipcRenderer.invoke('vi-hosts-update', host),
        deleteHost: (hostId) => ipcRenderer.invoke('vi-hosts-delete', hostId),

        // Credentials
        getCredentials: () => ipcRenderer.invoke('vi-credentials-list'),
        saveCredential: (label, type, value) => ipcRenderer.invoke('vi-credentials-save', { label, type, value }),
        deleteCredential: (credId) => ipcRenderer.invoke('vi-credentials-delete', { credId }),

        // Execution
        runSSH: (execSessionId, hostId, command, credId) => ipcRenderer.send('vi-ssh-run', { execSessionId, hostId, command, credId }),
        runSSHWithPassword: (execSessionId, hostId, command, password) => ipcRenderer.send('vi-ssh-run-with-password', { execSessionId, hostId, command, password }),
        cancelSSH: (execSessionId) => ipcRenderer.send('vi-ssh-cancel', { execSessionId }),

        // Host update
        updateHost: (host) => ipcRenderer.invoke('vi-hosts-update', host),

        // RDP
        launchRDP: (hostId) => ipcRenderer.invoke('vi-rdp-launch', { hostId }),

        // === NEW: Computer Use / Automation ===
        // Screen Capture
        captureScreen: (mode) => ipcRenderer.invoke('vi-capture-screen', { mode }), // mode: 'desktop' | 'window'
        getWindows: () => ipcRenderer.invoke('vi-get-windows'),

        // Vision Analysis
        analyzeScreenshot: (imageDataUrl) => ipcRenderer.invoke('vi-analyze-screenshot', { imageDataUrl }),

        // Task Translation & Execution
        translateTask: (task) => ipcRenderer.invoke('vi-translate-task', { task }),
        executeCommand: (command) => ipcRenderer.invoke('vi-execute-command', { command }),

        // Task Chain with progress
        executeChain: (tasks) => ipcRenderer.send('vi-execute-chain', { tasks }),
        onChainProgress: (callback) => ipcRenderer.on('vi-chain-progress', (_, data) => callback(data)),
        onChainComplete: (callback) => ipcRenderer.on('vi-chain-complete', (_, data) => callback(data)),
        removeChainListeners: () => {
            ipcRenderer.removeAllListeners('vi-chain-progress');
            ipcRenderer.removeAllListeners('vi-chain-complete');
        },

        // Browser
        openBrowser: (url) => ipcRenderer.invoke('vi-open-browser', { url })
    }
});
