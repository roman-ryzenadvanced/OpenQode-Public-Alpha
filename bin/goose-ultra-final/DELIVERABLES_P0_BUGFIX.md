# Goose Ultra - P0 Bugfix Contract (Design Lock Trap)

## 1. Issue Resolution Summary

### Bug: Design Lock Loop on Repair
- **Root Cause**: The system enforced "Design Lock" logic (demanding strict preservation) even when the user was trying to repair a broken/QA-failed build. 
- **Compounding Factor**: The `REDESIGN_OK` confirmation was not being latched, causing the model to repeatedly ask for clarification if the prompt context was reset or if the model's output didn't perfectly match the "Plan" format.
- **Fix**:
  - **S2 (Repair Mode Routing)**: Implemented logic in `LayoutComponents.tsx` to detect if the current file content contains "QA Check Failed". If detected, the system enters **REPAIR MODE**, which explicitly bypasses Design Lock and instructs the model that the goal is to *fix* the broken code.
  - **S3 (Redesign Latch)**: Added a session-based latch (`window._redesignApprovedSessions`) that stores `REDESIGN_OK` confirmation. Once provided, the system enters **REDESIGN APPROVED MODE** for all subsequent requests in that session, preventing clarification loops.
  - **Prompt Updating**: Updated `Modification Mode` prompts to be context-aware (Repair vs. Redesign vs. Standard modification).

## 2. Source Code Patches

| File | Issue | Change Summary |
| :--- | :--- | :--- |
| `src/components/LayoutComponents.tsx` | Design Lock Loop | Added `isQaFailureArtifact` check to route to REPAIR MODE; Added `_redesignApprovedSessions` latch; Updated System Prompts. |

## 3. Manual Test Report

| Test Case | Step | Result |
| :--- | :--- | :--- |
| **T1: Repair Mode** | (Simulated) Set current file to "QA Check Failed". Type "Fix the frontend". | **PASS**: Prompt switches to "REPAIR MODE ACTIVE". Model instructed to ignore design lock and fix styling. |
| **T2: Redesign Confirmation** | Type "REDESIGN_OK". | **PASS**: Latch is set. Subsequent prompts use "REDESIGN APPROVED MODE". |
| **T3: Standard Mod** | With valid project, type "Add a button". | **PASS**: Uses standard "MODIFICATION MODE with DESIGN LOCK ENABLED". |

## 4. Final Status
The critical "infinite loop" trap is resolved. Users can now seamlessly repair broken builds or authorize redesigns without fighting the concierge logic.
