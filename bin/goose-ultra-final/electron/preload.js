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
    },
    // Ollama Cloud
    ollama: {
        getKeyStatus: () => ipcRenderer.invoke('ollama-get-key-status'),
        saveKey: (key) => ipcRenderer.invoke('ollama-save-key', { key }),
        getModels: () => ipcRenderer.invoke('ollama-get-models')
    },

    // ==========================================
    // USER AUTHENTICATION SYSTEM
    // ==========================================
    user: {
        // Get list of secret questions
        getSecretQuestions: () => ipcRenderer.invoke('user-get-secret-questions'),

        // Create a new account (returns { success, user, secretCode, session } or { success: false, error })
        create: (displayName, questionId, answer) =>
            ipcRenderer.invoke('user-create', { displayName, questionId, answer }),

        // Login with secret code (returns { success, user, session } or { success: false, error })
        login: (secretCode) => ipcRenderer.invoke('user-login', { secretCode }),

        // Get current session (returns session object or null)
        getSession: () => ipcRenderer.invoke('user-get-session'),

        // Logout (optionally clean data)
        logout: (cleanData = false) => ipcRenderer.invoke('user-logout', { cleanData }),

        // Get user statistics
        getStats: (userId) => ipcRenderer.invoke('user-get-stats', { userId }),

        // Clean all user data (projects, chats, keys)
        cleanData: (userId) => ipcRenderer.invoke('user-clean-data', { userId }),

        // Get user's projects directory path
        getProjectsDir: (userId) => ipcRenderer.invoke('user-get-projects-dir', { userId })
    },

    // ==========================================
    // QWEN OAUTH (INLINE DEVICE FLOW)
    // ==========================================
    qwenAuth: {
        // Start the device authorization flow (triggers browser open)
        start: () => ipcRenderer.send('qwen-auth-start'),

        // Cancel ongoing authorization
        cancel: () => ipcRenderer.send('qwen-auth-cancel'),

        // Get current auth status
        getStatus: () => ipcRenderer.invoke('qwen-get-auth-status'),

        // Clear saved tokens
        clearTokens: () => ipcRenderer.invoke('qwen-clear-tokens'),

        // Event listeners for auth flow
        onProgress: (callback) => ipcRenderer.on('qwen-auth-progress', (_, data) => callback(data)),
        onSuccess: (callback) => ipcRenderer.on('qwen-auth-success', (_, creds) => callback(creds)),
        onError: (callback) => ipcRenderer.on('qwen-auth-error', (_, error) => callback(error)),

        // Cleanup listeners
        removeListeners: () => {
            ipcRenderer.removeAllListeners('qwen-auth-progress');
            ipcRenderer.removeAllListeners('qwen-auth-success');
            ipcRenderer.removeAllListeners('qwen-auth-error');
        }
    }
});
