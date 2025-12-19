# Qwen Authentication - Complete Fix Documentation

## Overview
This document details all the authentication fixes applied to OpenQode to resolve Qwen authentication issues across all tools (Launcher, TUI Gen5, Goose).

## Problem Statement
The Qwen authentication system was completely broken:
- `qwen` CLI v0.5.0-nightly had broken `-p` flag
- Tools couldn't authenticate independently
- No token sharing between tools
- CLI detection was incorrect
- Session expiry wasn't handled

## Solutions Implemented

### 1. Shared Token Storage
**Files Changed**: `qwen-oauth.mjs`, `qwen-oauth.cjs`

All tools now share tokens via `~/.opencode/qwen-shared-tokens.json`:

```javascript
// loadTokens() checks shared location first
const sharedTokenFile = path.join(os.homedir(), '.opencode', 'qwen-shared-tokens.json');

// saveTokens() writes to both locations
await writeFile(sharedTokenFile, JSON.stringify(sharedData, null, 2));
```

**Result**: Authenticate once, all tools work.

### 2. Direct API Integration
**File Changed**: `qwen-oauth.mjs` (lines 385-546)

Replaced broken CLI-based messaging with direct Qwen Chat API:

```javascript
const response = await fetch('https://chat.qwen.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${this.tokens.access_token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, messages, stream })
});
```

**Result**: No dependency on broken `qwen -p` CLI command.

### 3. Correct API Endpoint
**File Changed**: `qwen-oauth.mjs` (line 40)

Fixed endpoint URL:
- ❌ Wrong: `https://chat.qwen.ai/api/chat/completions`
- ❌ Wrong: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions`
- ✅ Correct: `https://chat.qwen.ai/api/v1/chat/completions`

**Result**: API calls work with OAuth tokens.

### 4. Auto Token Refresh
**File Changed**: `qwen-oauth.mjs` (lines 485-493)

Handles 401 errors with automatic refresh:

```javascript
if (response.status === 401) {
    if (this.tokens?.refresh_token) {
        await this.refreshToken();
        // Retry request
    } else {
        return { error: 'Session expired...', needsAuth: true };
    }
}
```

**Result**: Graceful session expiry handling.

### 5. Fixed CLI Detection
**Files Changed**: `qwen-oauth.mjs`, `qwen-oauth.cjs`, `auth-check.mjs`

Corrected CLI detection from broken command to proper version check:

```javascript
// Before: exec('qwen -p "ping" --help 2>&1')  ❌
// After:  spawn('qwen', ['--version'])  ✅
```

**Result**: Accurate CLI availability detection.

### 6. Independent Authentication
**Files Changed**: `auth-check.mjs`, `opencode-tui.cjs`, `auth.js`

Removed dependency on `opencode.exe`:
- Uses `node bin/auth.js` instead
- Works on all platforms
- No external executable required

**Result**: Cross-platform compatible authentication.

### 7. 3-Tier Cascading Authentication
**File Changed**: `bin/auth.js`

Intelligent fallback system:

```
Tier 1: Official Qwen CLI (bundled or global)
  ↓ (if not found)
Tier 2: OAuth Device Flow (if client ID configured)
  ↓ (if OAuth fails)
Tier 3: Manual Instructions (clear guidance)
```

**Result**: Multiple paths to successful authentication.

### 8. Bundled Official CLI
**Files Changed**: `package.json`, `bin/auth.js`

Added `@qwen-code/qwen-code` as dependency:

```json
"dependencies": {
  "@qwen-code/qwen-code": "^0.5.0",
  ...
}
```

Auth detection prioritizes local bundled CLI:

```javascript
const localCLI = path.join(__dirname, '..', 'node_modules', '.bin', 'qwen');
if (fs.existsSync(localCLI)) {
    // Use bundled CLI
}
```

**Result**: Out-of-the-box authentication for all users.

## File-by-File Changes

### qwen-oauth.mjs (ESM)
- **Lines 84-116**: Updated `loadTokens()` - reads from shared location
- **Lines 118-152**: Updated `saveTokens()` - writes to both local and shared
- **Lines 324-376**: Fixed `checkAuth()` - uses `--version` check
- **Lines 385-546**: Replaced `sendMessage()` - direct API calls
- **Line 40**: Corrected API endpoint URL

### qwen-oauth.cjs (CommonJS)
- **Lines 65-94**: Updated `loadTokens()` - shared token support
- **Lines 256-282**: Fixed `checkAuth()` - proper CLI detection

### bin/auth-check.mjs
- **Lines 57-91**: Changed to use `node bin/auth.js` instead of `opencode.exe`

### bin/opencode-tui.cjs
- **Lines 685-718**: Updated startup auth to use `node bin/auth.js`
- Fixed auth check logic to properly validate `.authenticated` property

### bin/auth.js
- **Complete rewrite**: 3-tier cascading authentication system
- **Lines 39-58**: Smart CLI detection (local + global)
- **Lines 61-109**: Tier 1 - Official CLI launcher
- **Lines 111-130**: Tier 2 - OAuth device flow
- **Lines 132-148**: Tier 3 - Manual instructions

### package.json
- Added `@qwen-code/qwen-code": "^0.5.0"` dependency

## Testing Checklist

- [x] Launcher (OpenQode.bat) triggers auth correctly
- [x] TUI Gen5 detects session expiry
- [x] Goose can use shared tokens
- [x] Auth cascades through all 3 tiers
- [x] Bundled CLI is detected and used
- [x] API calls work with correct endpoint
- [x] Tokens are shared across all tools
- [x] Error messages guide users correctly

## Known Limitations

1. **No Refresh Token in Shared Storage**: When using shared tokens from `opencode.exe`, they don't include `refresh_token`. Users must re-authenticate when tokens expire.

2. **OAuth Requires Client ID**: Tier 2 (OAuth) requires `QWEN_OAUTH_CLIENT_ID` in config.cjs. Most users will use Tier 1 (bundled CLI) instead.

3. **Session Duration**: Qwen tokens expire after ~24 hours. This is a Qwen limitation, not an OpenQode issue.

## Future Improvements

1. Implement token refresh endpoint scraping from CLI
2. Add automatic re-auth trigger when `needsAuth: true`
3. Create visual auth status indicator in TUI
4. Add token validity pre-check before API calls

## Commit History

All changes committed in 14 commits:
1. `fix: Windows auth check for Goose, TUI, and launcher`
2. `fix: Use opencode.exe auth qwen for authentication`
3. `fix: Share tokens with opencode.exe`
4. `fix: Replace CLI with direct Qwen Chat API`
5. `fix: Remove orphaned JSDoc comment causing syntax error`
6. `fix: Use chat.qwen.ai /v1/ endpoint for OAuth`
7. `feat: Add automatic token refresh on 401 errors`
8. `feat: Save tokens to shared location`
9. `feat: Make OpenQode.bat independent of opencode.exe`
10. `fix: Correct qwen-oauth require path in auth.js`
11. `fix: Update error messages to use 'node bin/auth.js'`
12. `fix: Update TUI startup auth to use node bin/auth.js`
13. `feat: Implement 3-tier cascading authentication`
14. `feat: Bundle official Qwen CLI with OpenQode`

## For Future AI Models

If you encounter authentication issues:

1. **Check token location**: `~/.opencode/qwen-shared-tokens.json`
2. **Verify API endpoint**: Must be `https://chat.qwen.ai/api/v1/chat/completions`
3. **Test bundled CLI**: `node node_modules/.bin/qwen --version`
4. **Run auth**: `node bin/auth.js` (cascading fallback)
5. **Check logs**: Look for "Session expired" or "401" errors

**DO NOT**:
- Use `qwen -p` flag (broken in v0.5.0-nightly)
- Hardcode opencode.exe paths (not cross-platform)
- Skip shared token storage (breaks tool integration)
- Use wrong API endpoints (causes 401/504 errors)

## References

- Qwen OAuth Docs: https://github.com/QwenLM/qwen-code
- Working Implementation: https://github.com/roman-ryzenadvanced/OpenQode-Public-Alpha
- Chat API Endpoint: https://chat.qwen.ai/api/v1/chat/completions
