# 🚀 Goose Ultra: Master Plan 2.0 (The "StackBlitz-Killer" Upgrade)

## ❌ The Problem: "Broken Frontends & Markdown Pollution"
The current "Regex-and-Pray" approach to code generation is failing. 
- LLMs are chatty; they mix prose with code.
- Markdown code blocks are unreliable (nesting issues, missing fences).
- "Quality Gates" catch failures *after* they happen, but don't prevent them.
- Users see raw HTML/text because the parser fails to extract the clean code.

## 🏆 The Competitive Solution (Benchmarked against Bolt.new & Cursor)
Top-tier AI IDEs do **NOT** use simple markdown parsing. They use **Structured Streaming Protocols**.

1.  **Bolt.new / StackBlitz**: Uses a custom XML-like streaming format (e.g., `<boltAction type="file" filePath="...">`) pushed to a WebContainer.
2.  **Cursor**: Uses "Shadow Workspaces" and "Diff Streams" to apply edits deterministically.
3.  **Claude Artifacts**: Uses strict XML tags `<antArtifact>` to completely separate code from conversation.

## 🛠️ The New Architecture: "Streaming Artifact Protocol" (SAP)

We will abandon the "Chat with Code" model and switch to a **"Direct Artifact Stream"** model.

### 1. The Protocol (SAP)
Instead of asking for "Markdown", we will force the LLM to output a precise XML stream:

```xml
<goose_artifact id="project-build-1" title="React Dashboard">
  <goose_file path="index.html">
    <![CDATA[
      <!DOCTYPE html>...
    ]]>
  </goose_file>
  <goose_file path="src/main.js">
    <![CDATA[ ... ]]>
  </goose_file>
  <goose_action type="shell">npm install</goose_action>
</goose_artifact>
```

### 2. The "Iron-Clad" Parsing Layer
We will implement a **State Machine Parser** in TypeScript that consumes the stream char-by-char.
- **State: WAITING**: Ignore all user-facing text (chat).
- **State: IN_TAG**: Detect `<goose_file>`.
- **State: IN_CONTENT**: Capture content directly to a buffer.
- **State: IN_CDATA**: Capture raw content without escaping issues.

**Benefit:** The LLM can waffle on about "Here is the code..." for pages, but our parser will silently discard it and *only* capture the pure bytes inside the tags.

### 3. The "Shadow Validator" (The Anti-Hallucination Step)
Before showing *anything* in the Preview:
1.  **Syntax Check**: Run `cheerio` (HTML) or `acorn` (JS) on the extracted artifacts.
2.  **Dependency Scan**: Ensure imported packages are actually in `package.json` (or CDN links via proper import maps).
3.  **Visual Health**: (Your new feature) checks the *parsed* result, not the raw stream.

### 4. Implementation Phase (Ops 4.5 Execution)
1.  **Refactor `automationService.ts`**: Replace `extractCode` regex with `ArtifactStreamParser` class.
2.  **Update System Prompts**: Hard-enforce the XML schema. "You are NOT a chat bot. You are a biological compiler. You OUTPUT XML ONLY."
3.  **Verify & Build**: One-click verify loop that rejects the plan *before* the user sees it if the XML is malformed.

---
**Status:** Ready for Approval.
**Execution Agent:** Opus 4.5
