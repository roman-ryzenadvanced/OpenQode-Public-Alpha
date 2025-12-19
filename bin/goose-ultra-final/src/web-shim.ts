
// Web Shim for Goose Ultra (Browser Edition)
// Proxies window.electron calls to the local server.js API

const API_BASE = 'http://localhost:15044/api';

// Type definitions for the messages
type ChatMessage = {
    role: string;
    content: string;
};

// Event listeners storage
const listeners: Record<string, ((...args: any[]) => void)[]> = {};

function addListener(channel: string, callback: (...args: any[]) => void) {
    if (!listeners[channel]) listeners[channel] = [];
    listeners[channel].push(callback);
}

function removeListeners(channel: string) {
    delete listeners[channel];
}

function emit(channel: string, ...args: any[]) {
    if (listeners[channel]) {
        listeners[channel].forEach(cb => cb(...args));
    }
}

// Helper to get or create a session token
// For local web edition, we might not have the CLI token file access.
// We'll try to use a stored token or prompt for one via the API.
async function getAuthToken(): Promise<string | null> {
    const stored = localStorage.getItem('openqode_token');
    if (stored) return stored;

    // If no token, maybe we can auto-login as guest for local?
    // Or we expect the user to have authenticated via the /api/auth endpoints.
    return null;
}

// Only inject if window.electron is missing
if (!(window as any).electron) {
    console.log('🌐 Goose Ultra Web Shim Active');

    (window as any).electron = {
        getAppPath: async () => {
            // Return a virtual path
            return '/workspace';
        },
        getPlatform: async () => 'web',
        getServerPort: async () => 15044,
        exportProjectZip: async (projectId: string) => {
            console.warn('Export ZIP not supported in Web Edition');
            return '';
        },

        // Chat Interface
        startChat: async (messages: ChatMessage[], model: string) => {
            try {
                const token = await getAuthToken();

                // We need to construct the prompt from messages
                // Simple concatenation for now, as server API expects a single string 'message'
                // or we send the last message if the server handles history?
                // Based on server.js, it sends 'message' to qwenOAuth.sendMessage.
                // We'll assume we send the full conversation or just the latest prompt + context.
                // Let's send the last message's content for now, or join them.

                const lastMessage = messages[messages.length - 1];
                if (!lastMessage) return;

                emit('chat-status', 'Connecting to server...');

                const response = await fetch(`${API_BASE}/chat/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: lastMessage.content,
                        model: model,
                        token: token || 'guest_token' // Fallback to allow server to potentially reject
                    })
                });

                if (!response.ok) {
                    throw new Error(`Server error: ${response.statusText}`);
                }

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();

                if (!reader) throw new Error('No response body');

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.type === 'chunk') {
                                    emit('chat-chunk', data.content);
                                } else if (data.type === 'done') {
                                    emit('chat-complete', ''); // Empty string as full response is built by chunks?
                                    // Actually preload.js expect 'chat-complete' with full response?
                                    // Or just 'chat-complete'?
                                    // Reviewing preload: onChatComplete callback(response).
                                    // We might need to accumulate chunks to send full response here?
                                    // But the UI likely builds it from chunks.
                                    // Just emitting DONE is important.
                                } else if (data.type === 'error') {
                                    emit('chat-error', data.error);
                                }
                            } catch (e) {
                                // ignore parse errors
                            }
                        }
                    }
                }
            } catch (err: any) {
                console.error('Chat Error:', err);
                emit('chat-error', err.message || 'Connection failed');
            }
        },

        onChatChunk: (cb: any) => addListener('chat-chunk', cb),
        onChatStatus: (cb: any) => addListener('chat-status', cb),
        onChatComplete: (cb: any) => addListener('chat-complete', cb),
        onChatError: (cb: any) => addListener('chat-error', cb),
        removeChatListeners: () => {
            removeListeners('chat-chunk');
            removeListeners('chat-status');
            removeListeners('chat-complete');
            removeListeners('chat-error');
        },

        // File System Interface
        fs: {
            list: async (path: string) => {
                const res = await fetch(`${API_BASE}/files/tree`);
                const data = await res.json();
                return data.tree;
            },
            read: async (path: string) => {
                const res = await fetch(`${API_BASE}/files/read?path=${encodeURIComponent(path)}`);
                const data = await res.json();
                return data.content;
            },
            write: async (path: string, content: string) => {
                await fetch(`${API_BASE}/files/write`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path, content })
                });
            },
            delete: async (path: string) => {
                await fetch(`${API_BASE}/files/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path })
                });
            }
        },

        // Skills Interface
        skills: {
            list: async () => {
                const res = await fetch(`${API_BASE}/skills/list`);
                const data = await res.json();
                return data.skills;
            },
            import: async (url: string) => {
                const res = await fetch(`${API_BASE}/skills/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
                return data.skill;
            },
            delete: async (id: string) => {
                const res = await fetch(`${API_BASE}/skills/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
            }
        }
    };
}
