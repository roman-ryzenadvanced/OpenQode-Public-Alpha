# Implementation Plan: Secret Key User System & Inline Qwen OAuth

## Overview

This plan outlines the implementation of:
1. **Secret Key User Authentication** - Users create accounts with a name + secret question, receive a unique key
2. **Isolated User Environments** - Each user has separate data (API keys, chats, sessions, projects)
3. **Inline Qwen OAuth** - Replace external CLI dependency with native device flow authentication

---

## Phase 1: User Identity & Secret Key System

### 1.1 Secret Code Generation

**Algorithm:**
```
SecretCode = Base64(SHA256(userName + secretQuestion + answer + timestamp + randomSalt))[:24]
```

Example output: `GU-AXBY12-CDWZ34-EFGH56`

**Security Properties:**
- One-way derivation (cannot reverse-engineer original answer)
- Time-salted to prevent duplicate codes
- 24-character code is memorable yet secure (144 bits of entropy)

### 1.2 User Data Model

```typescript
interface GooseUser {
  userId: string;           // UUID
  displayName: string;
  secretCodeHash: string;   // SHA256 hash of the secret code (for verification)
  createdAt: number;
  lastLoginAt: number;
}
```

### 1.3 Files & Storage Structure

**Location:** `%AppData%/GooseUltra/` (Windows) or `~/.config/GooseUltra/` (Linux/Mac)

```
GooseUltra/
├── system/
│   ├── users.json           # Array of GooseUser (stores hashes, not codes)
│   └── current_session.json # { userId, loginAt }
└── user_data/
    └── {userId}/
        ├── settings.json    # User-specific settings
        ├── qwen_tokens.json # User's Qwen OAuth credentials
        ├── ollama_key.enc   # User's Ollama API key
        ├── projects/        # User's projects
        ├── chats/           # User's chat history
        └── vault/           # User's credential vault
```

### 1.4 New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `LoginGate.tsx` | `src/components/` | Full-screen intro/login component |
| `UserOnboarding.tsx` | `src/components/` | Name + secret question wizard |
| `SecretCodeReveal.tsx` | `src/components/` | Shows code once with copy button |
| `UserContext.tsx` | `src/` | React context for current user |

### 1.5 Onboarding Flow

```
┌─────────────────────────────────────────┐
│         Welcome to Goose Ultra          │
│                                         │
│  ○ I'm new here (Create Account)       │
│  ○ I have a secret code (Login)         │
└─────────────────────────────────────────┘
           ↓ "New User"
┌─────────────────────────────────────────┐
│       Step 1: What's your name?         │
│  ┌─────────────────────────────────┐    │
│  │ [Your Display Name              ]    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│     Step 2: Set Your Secret Question    │
│                                         │
│  Pick a question (dropdown):            │
│  • Mother's maiden name?                │
│  • First pet's name?                    │
│  • Favorite teacher's name?             │
│  • City you were born in?               │
│  • Your custom question...              │
│                                         │
│  Your answer: [______________]          │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│     🎉 Your Secret Code is Ready!       │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  GU-AXBY12-CDWZ34-EFGH56        │   │ 
│  └──────────────────────────────────┘   │
│         [📋 Copy to Clipboard]          │
│                                         │
│  ⚠️ SAVE THIS CODE OFFLINE!            │
│  This is the ONLY way to log in.        │
│  We cannot recover it.                  │
│                                         │
│  [ ] I have saved my code securely      │
│                                         │
│         [Continue to Goose Ultra →]     │
└─────────────────────────────────────────┘
```

---

## Phase 2: User Data Isolation

### 2.1 Data Isolation Layer

**New Service:** `src/services/userDataService.ts`

```typescript
export class UserDataService {
  private userId: string | null = null;

  setCurrentUser(userId: string) { ... }
  
  getUserDataPath(): string { 
    // Returns: userData/user_data/{userId}/
  }
  
  async loadUserSettings(): Promise<UserSettings> { ... }
  async saveUserSettings(settings: UserSettings): Promise<void> { ... }
  
  async loadQwenTokens(): Promise<QwenCredentials | null> { ... }
  async saveQwenTokens(tokens: QwenCredentials): Promise<void> { ... }
  
  async getProjectsPath(): string { ... }
  async getChatsPath(): string { ... }
  
  async cleanUserData(): Promise<void> { 
    // Wipes all user data (projects, chats, keys)
  }
}
```

### 2.2 Logout & Clean Data

**Logout Flow:**
```
┌─────────────────────────────────────────┐
│           Logging Out...                │
│                                         │
│  Would you like to clean your data?     │
│                                         │
│  This will permanently delete:          │
│  • All your projects                    │
│  • All chat history                     │
│  • Saved API keys                       │
│  • Custom personas                      │
│                                         │
│  Your account will remain intact.       │
│  You can log in again with your code.   │
│                                         │
│  [Keep Data & Logout]  [Clean & Logout] │
└─────────────────────────────────────────┘
```

**"Clean Data" Explanation (to show users):**

> **What does "Clean Data" mean?**
> 
> Cleaning your data removes all personal information from this device, including:
> - **Projects:** All HTML, CSS, and JavaScript you've created
> - **Chat History:** All conversations with the AI
> - **API Keys:** Any Qwen or Ollama credentials you've entered
> - **Personas:** Custom AI personalities you've configured
> 
> **Why clean?**
> - You're using a shared or public computer
> - You want to free up disk space
> - You're troubleshooting issues
> - You want a fresh start
> 
> **Note:** Your account code will still work. Cleaning only affects data on THIS device.

---

## Phase 3: Inline Qwen OAuth (No External CLI)

### 3.1 Current vs. New Architecture

**Current Flow (Requires External CLI):**
```
User clicks "Auth" → Electron opens external Qwen CLI → CLI does OAuth → Writes ~/.qwen/oauth_creds.json → Goose reads it
```

**New Flow (Fully Inline):**
```
User clicks "Auth" → Electron starts Device Flow → Opens browser for authorization → Polls for token → Saves per-user
```

### 3.2 New Electron Module: `qwen-oauth.js`

**Based on:** `qwen-code-reference/packages/core/src/qwen/qwenOAuth2.ts`

```javascript
// electron/qwen-oauth.js

const QWEN_OAUTH_DEVICE_CODE_ENDPOINT = 'https://chat.qwen.ai/api/v1/oauth2/device/code';
const QWEN_OAUTH_TOKEN_ENDPOINT = 'https://chat.qwen.ai/api/v1/oauth2/token';
const QWEN_OAUTH_CLIENT_ID = 'f0304373b74a44d2b584a3fb70ca9e56';
const QWEN_OAUTH_SCOPE = 'openid profile email model.completion';
const QWEN_OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

// PKCE Helpers
function generateCodeVerifier() { ... }
function generateCodeChallenge(verifier) { ... }

// Main OAuth Flow
export async function startDeviceFlow(onProgress, onSuccess, onError) {
  // 1. Generate PKCE pair
  const { code_verifier, code_challenge } = generatePKCEPair();
  
  // 2. Request device code from Qwen
  const deviceAuthResponse = await fetch(QWEN_OAUTH_DEVICE_CODE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: QWEN_OAUTH_CLIENT_ID,
      scope: QWEN_OAUTH_SCOPE,
      code_challenge,
      code_challenge_method: 'S256'
    })
  });
  
  const { device_code, user_code, verification_uri_complete, expires_in } = await deviceAuthResponse.json();
  
  // 3. Notify UI with authorization URL
  onProgress({ 
    status: 'awaiting_auth', 
    url: verification_uri_complete, 
    userCode: user_code,
    expiresIn: expires_in
  });
  
  // 4. Open browser automatically
  shell.openExternal(verification_uri_complete);
  
  // 5. Poll for token
  const pollInterval = 2000;
  const maxAttempts = Math.ceil(expires_in / (pollInterval / 1000));
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(pollInterval);
    
    const tokenResponse = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: QWEN_OAUTH_GRANT_TYPE,
        client_id: QWEN_OAUTH_CLIENT_ID,
        device_code,
        code_verifier
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.access_token) {
      // SUCCESS!
      const credentials = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        resource_url: tokenData.resource_url,
        expiry_date: Date.now() + (tokenData.expires_in * 1000)
      };
      onSuccess(credentials);
      return;
    }
    
    if (tokenData.error === 'authorization_pending') {
      onProgress({ status: 'polling', attempt, maxAttempts });
      continue;
    }
    
    if (tokenData.error === 'slow_down') {
      pollInterval = Math.min(pollInterval * 1.5, 10000);
      continue;
    }
    
    // Other error
    onError(tokenData.error_description || tokenData.error);
    return;
  }
  
  onError('Authorization timed out');
}

export async function refreshAccessToken(refreshToken) { ... }
```

### 3.3 IPC Bridge Updates

**New handlers in `main.js`:**

```javascript
import * as qwenOAuth from './qwen-oauth.js';

// Start Device Authorization Flow
ipcMain.on('qwen-auth-start', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  
  await qwenOAuth.startDeviceFlow(
    (progress) => window.webContents.send('qwen-auth-progress', progress),
    (credentials) => {
      // Save to user-specific location
      const userId = getCurrentUserId(); // From session
      userDataService.saveQwenTokens(userId, credentials);
      window.webContents.send('qwen-auth-success', credentials);
    },
    (error) => window.webContents.send('qwen-auth-error', error)
  );
});

// Cancel ongoing auth
ipcMain.on('qwen-auth-cancel', () => {
  qwenOAuth.cancelAuth();
});
```

### 3.4 Preload Updates

```javascript
// preload.js - add to existing

qwenAuth: {
  start: () => ipcRenderer.send('qwen-auth-start'),
  cancel: () => ipcRenderer.send('qwen-auth-cancel'),
  onProgress: (cb) => ipcRenderer.on('qwen-auth-progress', (_, data) => cb(data)),
  onSuccess: (cb) => ipcRenderer.on('qwen-auth-success', (_, creds) => cb(creds)),
  onError: (cb) => ipcRenderer.on('qwen-auth-error', (_, err) => cb(err)),
}
```

### 3.5 UI Component: Inline Auth Dialog

```tsx
// src/components/QwenAuthDialog.tsx

export const QwenAuthDialog = ({ onComplete }: { onComplete: () => void }) => {
  const [status, setStatus] = useState<'idle' | 'awaiting' | 'polling' | 'success' | 'error'>('idle');
  const [authUrl, setAuthUrl] = useState('');
  const [userCode, setUserCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!window.electron?.qwenAuth) return;
    
    window.electron.qwenAuth.onProgress((data) => {
      if (data.status === 'awaiting_auth') {
        setStatus('awaiting');
        setAuthUrl(data.url);
        setUserCode(data.userCode);
      } else if (data.status === 'polling') {
        setStatus('polling');
      }
    });
    
    window.electron.qwenAuth.onSuccess(() => {
      setStatus('success');
      setTimeout(onComplete, 1500);
    });
    
    window.electron.qwenAuth.onError((err) => {
      setStatus('error');
      setError(err);
    });
  }, []);

  const startAuth = () => {
    setStatus('awaiting');
    window.electron?.qwenAuth?.start();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-2xl p-8 max-w-md w-full border border-white/10">
        {status === 'idle' && (
          <>
            <h2 className="text-2xl font-bold mb-4">Connect to Qwen</h2>
            <p className="text-zinc-400 mb-6">
              Authenticate with your Qwen account to access AI models.
            </p>
            <button onClick={startAuth} className="w-full py-3 bg-primary text-black font-bold rounded-xl">
              Sign in with Qwen
            </button>
          </>
        )}
        
        {status === 'awaiting' && (
          <>
            <h2 className="text-2xl font-bold mb-4">Complete in Browser</h2>
            <p className="text-zinc-400 mb-4">
              A browser window should have opened. Enter this code:
            </p>
            <div className="bg-black p-4 rounded-xl text-center mb-4">
              <span className="font-mono text-3xl text-primary">{userCode}</span>
            </div>
            <a href={authUrl} target="_blank" className="text-primary underline text-sm">
              Click here if browser didn't open
            </a>
          </>
        )}
        
        {status === 'polling' && (
          <>
            <h2 className="text-2xl font-bold mb-4">Waiting for Authorization...</h2>
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          </>
        )}
        
        {status === 'success' && (
          <>
            <h2 className="text-2xl font-bold text-primary mb-4">✓ Connected!</h2>
          </>
        )}
        
        {status === 'error' && (
          <>
            <h2 className="text-2xl font-bold text-red-500 mb-4">Authentication Failed</h2>
            <p className="text-zinc-400 mb-6">{error}</p>
            <button onClick={startAuth} className="w-full py-3 bg-zinc-800 text-white font-bold rounded-xl">
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
};
```

---

## Phase 4: Implementation Order

### Step 1: Foundation (Electron Main)
1. Create `userDataService.js` in `electron/`
2. Create `qwen-oauth.js` in `electron/`
3. Update `main.js` with new IPC handlers
4. Update `preload.js` with new bridges

### Step 2: User System (React)
1. Create `UserContext.tsx`
2. Create `LoginGate.tsx`
3. Create `UserOnboarding.tsx`
4. Create `SecretCodeReveal.tsx`
5. Wrap `App.tsx` with `LoginGate`

### Step 3: Data Migration
1. Migrate existing global data to first user
2. Update all file paths in services to use `userDataService`

### Step 4: Qwen OAuth UI
1. Create `QwenAuthDialog.tsx`
2. Update `AISettingsModal` to use inline auth
3. Remove references to external CLI

### Step 5: Logout & Cleanup
1. Add logout button to sidebar
2. Create cleanup dialog with explanation
3. Implement `cleanUserData()` function

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `electron/main.js` | Add user session management, new IPC handlers |
| `electron/preload.js` | Expose user and auth bridges |
| `electron/qwen-api.js` | Load tokens from user-specific path |
| `src/App.tsx` | Wrap with LoginGate and UserContext |
| `src/orchestrator.ts` | Make project loading user-aware |
| `src/services/automationService.ts` | Update file paths |
| `src/components/LayoutComponents.tsx` | Add logout button, update auth UI |

---

## Security Considerations

1. **Secret Code Storage**: Only SHA256 hash is stored; actual code never persisted
2. **Credential Isolation**: Each user's Qwen/Ollama tokens are in separate directories
3. **Clean Data**: Complete wipe of user-specific folder
4. **No Recovery**: By design, secret codes cannot be recovered (offline storage is essential)

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: User Identity | 4-6 hours |
| Phase 2: Data Isolation | 3-4 hours |
| Phase 3: Inline OAuth | 4-5 hours |
| Phase 4: Integration | 2-3 hours |
| **Total** | **13-18 hours** |
