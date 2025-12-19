# Goose Super - Known Issues & Bugs

## Critical (Fix Before Release)

### 1. ❌ Preview ERR_FILE_NOT_FOUND
**Screenshot:** 2024-12-16
**Issue:** Preview shows `file:///E:/calculator.html` instead of full project path
**Root Cause:** `normalizeUrlForPreview()` not resolving properly in all cases
**Fix:** Need to check if file exists before loading, and fall back to projectRootPath

### 2. ❌ "use code editor" Opens Notepad Instead of Built-In Editor
**Screenshot:** 2024-12-16
**Issue:** User says "use code editor" but IQ Exchange outputs `OPEN_APP app="notepad"`
**Root Cause:** Translation prompt doesn't know about built-in Editor panel
**Fix:** Add [ACTION:OPEN_EDITOR] action and teach translation about built-in tools

### 3. ⚠️ IQ Exchange Translation Issues  
**Issue:** Sometimes outputs "needs more specific instructions" instead of actions
**Root Cause:** Translation prompt may not be specific enough for simple tasks
**Fix:** Improve `translateTaskToActions()` prompt or add fallback to chat

---

## Medium Priority

### 4. Panel Layout Edge Cases
- [ ] Very narrow windows may still cause overlap
- [ ] Multiple rapid panel toggles can cause animation glitches

### 5. TODO/Follow-up Persistence
- [ ] Items persist in localStorage but not synced to session file
- [ ] No pagination for many items

### 6. Code Block Copy Button
- [ ] `copyCode()` function defined but button may not work in all cases
- [ ] Need to verify clipboard API works in Electron

---

## Low Priority / Polish

### 7. Typography & Icons
- [ ] Some emoji icons may render inconsistently on Windows
- [ ] Font loading can be slow on first launch

### 8. Status Indicator Accuracy
- [ ] "Ready" shows even when auth not verified
- [ ] Token counter is character-based, not actual tokens

---

## Recently Fixed (Phase 0)

- ✅ Layout squeeze with multiple panels (CSS transitions)
- ✅ IQ Exchange mojibake (🧠⚡✅ emojis)
- ✅ TODO sidebar animations (slideInLeft)
- ✅ Code block wrapper CSS
- ✅ File save + preview auto-refresh

---

*Updated: 2024-12-16*
