# 🚀 Goose Ultra: Master Plan v3.0 (Complete Architecture)

## Executive Summary
SAP (Streaming Artifact Protocol) fixes **parsing reliability** but does NOT fix:
- ❌ Skipped plan approval (users go straight to broken builds)
- ❌ Wrong app generation (CBT game requested → dashboard generated)
- ❌ Redesign drift (small edits cause full regeneration)
- ❌ Cross-talk (old sessions pollute new ones)

**This plan implements SAP + 4 Critical Layers as a single atomic upgrade.**

---

## Layer 0: SAP (Streaming Artifact Protocol) ✅ DONE
- XML-based output format with `<goose_file>` tags
- CDATA wrapping to prevent escaping issues
- Fallback to legacy markdown parsing
- **Status:** Implemented in previous commit

---

## Layer 1: PLAN_FIRST_STATE_MACHINE

### Rule
> "Idea submission must generate a plan first; build is forbidden until user approves."

### State Machine
```
STATES: IDLE → PLANNING → PLAN_READY → BUILDING → PREVIEW_READY
                    ↓           ↑
                  ERROR ←───────┘
```

### Transitions
| From | To | Event | Guard |
|------|----|-------|-------|
| IDLE | PLANNING | SUBMIT_IDEA | - |
| PLANNING | PLAN_READY | PLAN_COMPLETE | Plan text received |
| PLAN_READY | BUILDING | APPROVE_PLAN | User clicked Approve |
| PLAN_READY | PLANNING | EDIT_PLAN | User edited and resubmitted |
| PLAN_READY | IDLE | REJECT_PLAN | User clicked Reject |
| BUILDING | PREVIEW_READY | BUILD_SUCCESS | Files written & QA passed |
| BUILDING | ERROR | BUILD_FAIL | QA failed or timeout |

### Hard Guards (Enforced in Code)
1. **No BUILDING without APPROVE_PLAN:** The `handleApprove()` function is the ONLY path to BUILDING state.
2. **Approve button disabled until PLAN_COMPLETE:** UI shows disabled button during PLANNING.
3. **No auto-build:** Removing any code that transitions directly from PLANNING → BUILDING.

### Implementation
- File: `src/types.ts` - Add missing states (PLAN_READY)
- File: `src/orchestrator.ts` - Enforce transitions
- File: `src/components/Views.tsx` - Guard UI buttons

---

## Layer 2: SESSION_GATING

### Rule
> "Prevent cross-talk: only the active sessionId may update UI or write files."

### Requirements
1. **Every stream emits sessionId:** Wrap all `electron.onChatChunk/Complete/Error` calls with sessionId tracking.
2. **UI ignores stale events:** Before dispatching any action, check `if (sessionId !== activeSessionId) return;`
3. **Cancel marks session as cancelled:** `dispatch({ type: 'CANCEL_SESSION', sessionId })` sets a flag.
4. **Single finalize path:** All sessions end via one of: COMPLETE, ERROR, CANCEL, TIMEOUT.

### Implementation
- Add `activeSessionId` to orchestrator state
- Add `START_SESSION` and `END_SESSION` actions
- Wrap all stream handlers with session checks
- Add timeout watchdog (30s default)

---

## Layer 3: PATCH_ONLY_MODIFICATIONS

### Rule
> "Existing project edits must be patch-based; no full regeneration."

### Requirements
1. **Patch JSON format:** Model outputs bounded operations only:
   ```json
   {
     "patches": [
       { "op": "replace", "anchor": "<!-- HERO_SECTION -->", "content": "..." },
       { "op": "insert_after", "anchor": "</header>", "content": "..." }
     ]
   }
   ```
2. **Deterministic applier:** Local code applies patches, enforces:
   - Max 500 lines changed per patch
   - Forbidden zones (e.g., `<head>` metadata)
3. **REDESIGN_OK gate:** Full regeneration blocked unless user explicitly says "redesign" or "rebuild from scratch".

### Implementation
- New file: `src/services/PatchApplier.ts`
- Update: `applyPlanToExistingHtml()` to use patch format
- Update: System prompt for modification mode

---

## Layer 4: QUALITY_AND_TASK_MATCH_GUARDS

### Rule
> "Block broken UI and wrong-app output before writing or previewing."

### Quality Gates (Already Partially Implemented)
| Gate | Check | Action on Fail |
|------|-------|----------------|
| artifact_type_gate | No [PLAN] markers, no markdown headings without HTML | Block |
| html_validity_gate | Has DOCTYPE, html, body tags | Block |
| styling_presence_gate | Has Tailwind CDN or >20 CSS rules | Warn + Retry |
| runtime_sanity_gate | No console errors in sandboxed render | Warn |

### Task Match Gate (NEW)
- **Rule:** If user asked for "X" but AI generated "Y", block and retry.
- **Implementation:**
  1. Extract keywords from original prompt (e.g., "CBT game", "stress relief")
  2. Analyze generated HTML for matching keywords in titles, headings, content
  3. If mismatch score > 0.7, block and auto-retry with:
     ```
     RETRY REASON: User requested "CBT mini games" but output appears to be "Dashboard".
     ```

### Auto-Repair
- Max 2 retry attempts
- Each retry includes: failure reasons + original request + project context

---

## Implementation Order

| Phase | Layer | Files | Complexity |
|-------|-------|-------|------------|
| 1 | PLAN_FIRST_STATE_MACHINE | types.ts, orchestrator.ts, Views.tsx | High |
| 2 | SESSION_GATING | orchestrator.ts, Views.tsx, LayoutComponents.tsx | High |
| 3 | PATCH_ONLY_MODIFICATIONS | PatchApplier.ts, automationService.ts | Medium |
| 4 | QUALITY_AND_TASK_MATCH_GUARDS | automationService.ts (extend gates) | Medium |
| 5 | Integration Testing | - | - |

---

## Definition of Done
- [ ] SAP implemented ✅
- [ ] No build starts without plan approval
- [ ] No cross-talk between sessions
- [ ] Small changes do not redesign apps
- [ ] Broken/unstyled outputs are blocked and repaired before preview
- [ ] Wrong-app outputs are blocked (task-match gate)

---

**Status:** Ready for Approval
**Execution Agent:** Opus 4.5
