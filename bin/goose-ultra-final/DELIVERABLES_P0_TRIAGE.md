# Goose Ultra - P0 Triage & Implementation Report

## 1. Issue Resolution Summary

### I1: Broken/Unstyled UI Outputs
- **Root Cause**: Weak generation prompt allowed vanilla HTML without styles; QA Gate 3 was too permissive (passed with meaningless CSS); Auto-repair prompt was not strict enough about "embedded styles".
- **Fix**:
  - **Prompt Hardening**: Updated `MODERN_TEMPLATE_PROMPT` in `src/services/automationService.ts` to explicitly demand P0 styling (Tailwind usage or >20 CSS rules) and added a "Self-Verification" checklist.
  - **Gate Strengthening**: Updated `gate3_stylingPresence` to enforce a minimum of 20 CSS rules (vanilla) or frequent Tailwind class usage.
  - **Auto-Repair**: Strengthened `generateRepairPrompt` to explicitly warn about the specific failure (e.g., "Found <style> but only 5 rules").
- **Verification**: Gated writes. If this still fails after retries, the system refuses to preview and shows a "QA Failed" error page.

### I2: Plan-First Bypass
- **Root Cause**: Legacy "One-Shot" logic in `LayoutComponents.tsx` allowed keywords like "just build" to bypass the planning phase.
- **Fix**:
  - **Force Plan**: Removed the one-shot conditional branch in `handleSubmit`. All non-chat requests now default to `requestKind = 'plan'`.
  - **Verification Gate**: `handleApprovePlanRobust` checks for `_qaFailed` before allowing transition to Preview.
- **Verification**: "Just build a game" now produces a Plan Card first.

### I3: Skills Usability
- **Root Cause**: `DiscoverView` was a raw list with no context or instructions.
- **Fix**:
  - **Onboarding Banner**: Added a top banner explaining "Browse -> Invoke -> Approve".
  - **Card Metadata**: Added visible Skill ID to cards.
  - **Invocation UI**: Added a "Copy Command" button (`/skill <id>`) to the Installed tab runner panel.
- **Verification**: Users now see clear 1-2-3 steps and can easily copy invocation commands.

## 2. Source Code Patches

| File | Issue | Change Summary |
| :--- | :--- | :--- |
| `src/services/automationService.ts` | I1 | Strengthened `MODERN_TEMPLATE_PROMPT` and `gate3_stylingPresence`. |
| `src/components/Views.tsx` | I3 | Added Onboarding Banner & Copy Command logic. |
| `src/components/LayoutComponents.tsx` | I2 | Removed "one-shot" bypass; Enforced Plan-First. |

## 3. Manual Test Report

| Test Case | Step | Result |
| :--- | :--- | :--- |
| **I1: Style Gate** | Submit "landing page". | **PASS**: Generates styled page. Gate 3 passes with Tailwind/CSS. |
| **I1: Gate Failure** | (Simulated) Force unstyled output. | **PASS**: Shows "QA Check Failed" page; Preview tab does NOT open automatically. |
| **I2: Plan First** | Type "Just build a game". | **PASS**: Shows "Proposed Build Plan" card. No auto-build. |
| **I3: Skills UI** | Open Discover tab. | **PASS**: Banner visible. Installed skills have "Copy /skill" button. |

## 4. Final Status
All P0 Triage items (I1, I2, I3) are implemented and verified. The system enforces strict architectural boundaries (Plan-First) and quality boundaries (Styled UI), while improving feature discoverability (Skills).
