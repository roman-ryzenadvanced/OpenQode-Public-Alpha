# Fluid Sidebar Activity Plan

## Goal
Transform the "laggy" sidebar counters into a fluid, high-energy "Dashboard" with smooth animations and speed metrics.

## Proposed Changes

### 1. New Helper: `SmoothCounter` (`bin/opencode-ink.mjs`)
- **Prop**: `value` (Target number)
- **Logic**: 
  - On `value` change, start a 50ms interval.
  - Increment `displayValue` towards `value` by a dynamic step `(delta / 2)`.
  - Effect: Numbers "roll" up rapidly instead of jumping.

### 2. New Hook: `useTrafficRate` (`bin/opencode-ink.mjs`)
- **Input**: `value` (increasing number)
- **Logic**:
  - Store `(timestamp, value)` tuples for last 2 seconds.
  - Calculate delta over time -> `chars/sec`.
  - Return `rate`.

### 3. Update `Sidebar` Component
- **Header**: `⚡ ACTIVITY (LIVE)` with blinking dot?
- **Stats**:
  - `📝 Chars`: Use `<SmoothCounter />`
  - `🚀 Speed`: `<SmoothCounter value={rate} /> ch/s`
- **Visuals**:
  - "Pulse Bar": `[▓▓▓░░]` length depends on `rate` (higher speed = longer bar).

## Verification
1.  **Run Chat**: Ask "Write a long story".
2.  **Observe**:
    -   Do numbers "roll" smoothly?
    -   Does Speed indicator fluctuate?
    -   Is the UI responsive (no lag)?
