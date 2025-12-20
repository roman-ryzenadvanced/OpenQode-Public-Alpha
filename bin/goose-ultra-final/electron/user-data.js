/**
 * User Data Service for Goose Ultra
 * 
 * Manages user authentication, session, and data isolation.
 * Each user has their own isolated environment with separate:
 * - Projects
 * - Chat history
 * - API keys (Qwen, Ollama)
 * - Custom personas
 * - Settings
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// ===== USER DATA STRUCTURE =====

/**
 * @typedef {Object} GooseUser
 * @property {string} userId - UUID
 * @property {string} displayName - User's chosen display name
 * @property {string} secretCodeHash - SHA256 hash of the secret code
 * @property {string} secretQuestionId - ID of the secret question used
 * @property {number} createdAt - Timestamp
 * @property {number} lastLoginAt - Timestamp
 */

/**
 * @typedef {Object} UserSession
 * @property {string} userId
 * @property {string} displayName
 * @property {number} loginAt
 */

// ===== FILE PATHS =====

const getSystemDir = () => path.join(app.getPath('userData'), 'system');
const getUsersFile = () => path.join(getSystemDir(), 'users.json');
const getSessionFile = () => path.join(getSystemDir(), 'current_session.json');
const getUserDataDir = () => path.join(app.getPath('userData'), 'user_data');

// ===== SECRET QUESTIONS =====

export const SECRET_QUESTIONS = [
    { id: 'mother_maiden', question: "What is your mother's maiden name?" },
    { id: 'first_pet', question: "What was your first pet's name?" },
    { id: 'favorite_teacher', question: "What was your favorite teacher's name?" },
    { id: 'birth_city', question: "In what city were you born?" },
    { id: 'first_car', question: "What was the make of your first car?" },
    { id: 'childhood_nickname', question: "What was your childhood nickname?" },
    { id: 'custom', question: "Custom question (user-defined)" }
];

// ===== SECRET CODE GENERATION =====

/**
 * Generate a unique secret code for a new user
 * Format: GU-XXXX-XXXX-XXXX (16 alphanumeric chars)
 * 
 * @param {string} displayName 
 * @param {string} questionId 
 * @param {string} answer 
 * @returns {string} The secret code
 */
export function generateSecretCode(displayName, questionId, answer) {
    const timestamp = Date.now().toString();
    const salt = crypto.randomBytes(16).toString('hex');
    const raw = `${displayName}|${questionId}|${answer}|${timestamp}|${salt}`;

    // Create a hash and take 12 bytes
    const hash = crypto.createHash('sha256').update(raw).digest();
    const encoded = hash.slice(0, 12).toString('base64url').toUpperCase();

    // Format as GU-XXXX-XXXX-XXXX
    const formatted = `GU-${encoded.slice(0, 4)}-${encoded.slice(4, 8)}-${encoded.slice(8, 12)}`;

    return formatted;
}

/**
 * Hash a secret code for secure storage
 * @param {string} secretCode 
 * @returns {string} SHA256 hash
 */
export function hashSecretCode(secretCode) {
    // Normalize the code (remove dashes, uppercase)
    const normalized = secretCode.replace(/-/g, '').toUpperCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ===== USER MANAGEMENT =====

/**
 * Ensure system directories exist
 */
function ensureSystemDirs() {
    const systemDir = getSystemDir();
    const userDataDir = getUserDataDir();

    if (!fs.existsSync(systemDir)) {
        fs.mkdirSync(systemDir, { recursive: true });
    }
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }
}

/**
 * Load all registered users
 * @returns {GooseUser[]}
 */
export function loadUsers() {
    ensureSystemDirs();

    try {
        if (fs.existsSync(getUsersFile())) {
            return JSON.parse(fs.readFileSync(getUsersFile(), 'utf8'));
        }
    } catch (e) {
        console.error('[UserData] Failed to load users:', e.message);
    }

    return [];
}

/**
 * Save users list
 * @param {GooseUser[]} users 
 */
function saveUsers(users) {
    ensureSystemDirs();
    fs.writeFileSync(getUsersFile(), JSON.stringify(users, null, 2));
}

/**
 * Create a new user account
 * 
 * @param {string} displayName 
 * @param {string} questionId 
 * @param {string} answer 
 * @returns {{ user: GooseUser, secretCode: string }}
 */
export function createUser(displayName, questionId, answer) {
    ensureSystemDirs();

    const userId = crypto.randomUUID();
    const secretCode = generateSecretCode(displayName, questionId, answer);
    const secretCodeHash = hashSecretCode(secretCode);
    const now = Date.now();

    const user = {
        userId,
        displayName,
        secretCodeHash,
        secretQuestionId: questionId,
        createdAt: now,
        lastLoginAt: now
    };

    // Add to users list
    const users = loadUsers();
    users.push(user);
    saveUsers(users);

    // Create user's data directory
    const userDir = path.join(getUserDataDir(), userId);
    fs.mkdirSync(userDir, { recursive: true });

    // Create subdirectories
    fs.mkdirSync(path.join(userDir, 'projects'), { recursive: true });
    fs.mkdirSync(path.join(userDir, 'chats'), { recursive: true });
    fs.mkdirSync(path.join(userDir, 'vault'), { recursive: true });

    // Initialize settings
    const defaultSettings = {
        preferredFramework: null,
        chatPersona: 'assistant',
        theme: 'dark',
        createdAt: now
    };
    fs.writeFileSync(
        path.join(userDir, 'settings.json'),
        JSON.stringify(defaultSettings, null, 2)
    );

    console.log('[UserData] Created new user:', userId, displayName);

    return { user, secretCode };
}

/**
 * Authenticate a user with their secret code
 * 
 * @param {string} secretCode 
 * @returns {GooseUser | null}
 */
export function authenticateUser(secretCode) {
    const hash = hashSecretCode(secretCode);
    const users = loadUsers();

    const user = users.find(u => u.secretCodeHash === hash);

    if (user) {
        // Update last login
        user.lastLoginAt = Date.now();
        saveUsers(users);
        console.log('[UserData] User authenticated:', user.userId);
        return user;
    }

    console.log('[UserData] Authentication failed: invalid secret code');
    return null;
}

// ===== SESSION MANAGEMENT =====

/**
 * Start a user session
 * @param {GooseUser} user 
 */
export function startSession(user) {
    const session = {
        userId: user.userId,
        displayName: user.displayName,
        loginAt: Date.now()
    };

    ensureSystemDirs();
    fs.writeFileSync(getSessionFile(), JSON.stringify(session, null, 2));
    console.log('[UserData] Session started for:', user.displayName);

    return session;
}

/**
 * Get the current active session
 * @returns {UserSession | null}
 */
export function getCurrentSession() {
    try {
        if (fs.existsSync(getSessionFile())) {
            return JSON.parse(fs.readFileSync(getSessionFile(), 'utf8'));
        }
    } catch (e) {
        console.error('[UserData] Failed to load session:', e.message);
    }

    return null;
}

/**
 * End the current session (logout)
 */
export function endSession() {
    try {
        if (fs.existsSync(getSessionFile())) {
            fs.unlinkSync(getSessionFile());
            console.log('[UserData] Session ended');
        }
    } catch (e) {
        console.error('[UserData] Failed to end session:', e.message);
    }
}

// ===== USER DATA PATHS =====

/**
 * Get the data directory for a specific user
 * @param {string} userId 
 */
export function getUserDirectory(userId) {
    return path.join(getUserDataDir(), userId);
}

/**
 * Get the projects directory for a user
 * @param {string} userId 
 */
export function getUserProjectsDir(userId) {
    return path.join(getUserDirectory(userId), 'projects');
}

/**
 * Get the chats directory for a user
 * @param {string} userId 
 */
export function getUserChatsDir(userId) {
    return path.join(getUserDirectory(userId), 'chats');
}

/**
 * Get the vault directory for a user
 * @param {string} userId 
 */
export function getUserVaultDir(userId) {
    return path.join(getUserDirectory(userId), 'vault');
}

/**
 * Get user settings path
 * @param {string} userId 
 */
export function getUserSettingsPath(userId) {
    return path.join(getUserDirectory(userId), 'settings.json');
}

// ===== DATA CLEANUP =====

/**
 * Clean all data for a specific user
 * This removes:
 * - All projects
 * - All chats
 * - All saved credentials
 * - Custom personas
 * - Settings
 * 
 * Note: The user account itself remains intact
 * 
 * @param {string} userId 
 */
export function cleanUserData(userId) {
    const userDir = getUserDirectory(userId);

    if (!fs.existsSync(userDir)) {
        console.log('[UserData] No data to clean for user:', userId);
        return;
    }

    // Remove all contents but keep the directory structure
    const removeContents = (dir) => {
        if (!fs.existsSync(dir)) return;

        const items = fs.readdirSync(dir);
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);

            if (stat.isDirectory()) {
                fs.rmSync(itemPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(itemPath);
            }
        }
    };

    // Clean each subdirectory
    removeContents(path.join(userDir, 'projects'));
    removeContents(path.join(userDir, 'chats'));
    removeContents(path.join(userDir, 'vault'));

    // Reset settings to default
    const defaultSettings = {
        preferredFramework: null,
        chatPersona: 'assistant',
        theme: 'dark',
        createdAt: Date.now(),
        cleanedAt: Date.now()
    };

    try {
        fs.writeFileSync(
            path.join(userDir, 'settings.json'),
            JSON.stringify(defaultSettings, null, 2)
        );
    } catch (e) {
        console.error('[UserData] Failed to reset settings:', e.message);
    }

    // Remove Qwen tokens
    const tokenPath = path.join(userDir, 'qwen_tokens.json');
    if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
    }

    console.log('[UserData] Cleaned all data for user:', userId);
}

/**
 * Delete a user account completely
 * @param {string} userId 
 */
export function deleteUser(userId) {
    // Remove user data
    const userDir = getUserDirectory(userId);
    if (fs.existsSync(userDir)) {
        fs.rmSync(userDir, { recursive: true, force: true });
    }

    // Remove from users list
    let users = loadUsers();
    users = users.filter(u => u.userId !== userId);
    saveUsers(users);

    console.log('[UserData] Deleted user:', userId);
}

// ===== MIGRATION =====

/**
 * Migrate legacy global data to a user's isolated environment
 * This is called when:
 * 1. First user is created and old data exists
 * 2. Explicitly requested by user
 * 
 * @param {string} userId 
 * @param {string} legacyProjectsDir - Old global projects directory
 */
export function migrateGlobalDataToUser(userId, legacyProjectsDir) {
    const userProjectsDir = getUserProjectsDir(userId);

    if (!fs.existsSync(legacyProjectsDir)) {
        console.log('[UserData] No legacy data to migrate');
        return;
    }

    // Copy all projects
    const projects = fs.readdirSync(legacyProjectsDir);
    for (const project of projects) {
        const src = path.join(legacyProjectsDir, project);
        const dest = path.join(userProjectsDir, project);

        if (fs.statSync(src).isDirectory()) {
            fs.cpSync(src, dest, { recursive: true });
        }
    }

    console.log('[UserData] Migrated', projects.length, 'projects to user:', userId);
}

// ===== STATISTICS =====

/**
 * Get statistics about a user's data
 * @param {string} userId 
 */
export function getUserStats(userId) {
    const userDir = getUserDirectory(userId);

    const countItems = (dir) => {
        try {
            return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
        } catch {
            return 0;
        }
    };

    const getDirSize = (dir) => {
        if (!fs.existsSync(dir)) return 0;

        let size = 0;
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
            const itemPath = path.join(dir, item.name);
            if (item.isDirectory()) {
                size += getDirSize(itemPath);
            } else {
                size += fs.statSync(itemPath).size;
            }
        }

        return size;
    };

    return {
        projectCount: countItems(getUserProjectsDir(userId)),
        chatCount: countItems(getUserChatsDir(userId)),
        totalSizeBytes: getDirSize(userDir),
        hasQwenTokens: fs.existsSync(path.join(userDir, 'qwen_tokens.json'))
    };
}
