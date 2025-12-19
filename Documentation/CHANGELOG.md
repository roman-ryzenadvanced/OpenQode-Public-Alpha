# OpenQode v1.01 - Changelog

## [2025-12-16] Qwen Authentication Complete Overhaul

### Added
- **Bundled Official Qwen CLI**: Added `@qwen-code/qwen-code` v0.5.0 as dependency
- **3-Tier Cascading Authentication**: Smart fallback system (CLI → OAuth → Manual)
- **Shared Token Storage**: All tools share tokens via `~/.opencode/qwen-shared-tokens.json`
- **Direct API Integration**: Qwen Chat API calls without CLI dependency
- **Auto Token Refresh**: Handles 401 errors gracefully

### Fixed
- ❌ → ✅ **CLI Detection**: Now uses `qwen --version` instead of broken `-p` flag
- ❌ → ✅ **API Endpoint**: Corrected to `https://chat.qwen.ai/api/v1/chat/completions`
- ❌ → ✅ **Token Expiry**: Proper session expiry messages and handling
- ❌ → ✅ **Cross-Platform Auth**: Removed `opencode.exe` dependency
- ❌ → ✅ **CLI Messaging**: Replaced broken `qwen -p` with API calls

### Changed
- **auth-check.mjs**: Uses `node bin/auth.js` instead of `opencode.exe`
- **opencode-tui.cjs**: Independent authentication on startup
- **qwen-oauth.mjs**: Complete sendMessage rewrite for API calls
- **qwen-oauth.cjs**: Token loading from shared location
- **auth.js**: Complete rewrite with 3-tier system

### Removed
- Dependency on `opencode.exe` for authentication
- Broken `qwen -p` CLI messaging approach
- Hardcoded authentication paths

### Technical Details
- **14 commits** implementing comprehensive authentication fixes
- **8 files** modified with backwards-compatible changes
- **Zero breaking changes** - existing installations continue to work

### For Developers
See `QWEN_AUTH_FIX_DOCUMENTATION.md` for complete technical details of all changes.

---

## Previous Versions
_(Add previous changelog entries here as needed)_
