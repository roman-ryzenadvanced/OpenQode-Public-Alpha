# Implementation Plan: Agent Visuals & Responsive Layout

## 1. In-Chat Agent Visuals
**Goal**: Make agent persona switches (e.g., `[AGENT: Security]`) visually distinct in the chat history.

-   **Modify `flattenMessagesToBlocks` (`bin/opencode-ink.mjs`)**:
    -   Regex match `\[AGENT:\s*([^\]]+)\]`.
    -   Create a new block type `{ type: 'agent_tag', name: 'Security' }`.
-   **Add Test Case (`tests/tui-components.test.mjs`)**:
    -   Verify `flattenMessagesToBlocks` correctly splits `[AGENT: Name]` strings into blocks.
    -   Run `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/` to verify.
-   **Modify `ViewportMessage` (`bin/opencode-ink.mjs`)**:
    -   Handle `type === 'agent_tag'`.
    -   Render:
        ```javascript
        h(Box, { borderStyle: 'round', borderColor: 'magenta', paddingX: 1, marginTop: 1 },
            h(Text, { color: 'magenta', bold: true }, '🤖 Security Agent')
        )
        ```

## 2. Hardened Responsive Layout
**Goal**: Prevent text wrapping/overflow when resizing the terminal.

-   **Audit `markdown-ink-esm.mjs`**: Ensure it strictly respects the `width` prop.
-   **Audit `ViewportMessage`**:
    -   Ensure `width` prop passed to `<Markdown>` accounts for padding/gutters (e.g., `width={width - 4}`).
    -   Check `CodeCard` width constraints.
-   **Verify `App` Layout**:
    -   `calculateViewport` should already be dynamic.
    -   Ensure `useTerminalSize` is updating correctly.

## Verification
-   Run chat with "Using Security Agent...".
-   Verify visible badge.
-   Resize window narrower -> Text should wrap, not cut off.
