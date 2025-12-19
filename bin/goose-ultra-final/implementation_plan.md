# Implementation Plan: Goose Ultra Architecture Refinement

## 1. Mem0 Source Map & Architecture Reuse
**Goal**: Map Goose Ultra's local memory features to Mem0 concepts.

| Feature | Mem0 Concept | Goose Ultra Implementation (Local) |
| :--- | :--- | :--- |
| **Project-Scoped Memory** | `Multi-Level Memory` (User/Session/Agent) | `apps/mem0/memory.jsonl` (Project Level) |
| **Memory Extraction** | `Fact Extraction` (LLM-based) | `extractMemoriesFromText` (Qwen Code Prompt) |
| **Top-K Retrieval** | `Vector Retrieval` / `Hybrid Search` | `retrieveRelevantMemories` (Keyword + Recency Scoring) |
| **Deduplication** | `Adaptive Learning` / `Dynamic Updates` | `addMemory` with existing key check & confidence update |
| **Storage** | `Vector DB` (Chroma/Qdrant) + `SQL/NoSQL` | `JSONL` file (Simpler, local-only constraint) |

**Mem0 Source Locations (Inferred)**:
- Memory Logic: `mem0/memory/main.py`
- Utils/Formatting: `mem0/memory/utils.py`
- Prompts: `mem0/configs/prompts.py`
- Vector Store Interfaces: `mem0/vector_stores/*`

## 2. Quality Gates (UI Enhancements)
**Goal**: Prevent "Plan Text" or "Unstyled" apps from reaching the user.
**Current Status**: Partially implemented in `automationService.ts`.
**Refinements Needed**:
- Ensure `compilePlanToCode` calls `runQualityGates`. (It does)
- Ensure `writeArtifacts` (or equivalent) respects the gate result. (It does in `generateMockFiles`).
- **Missing**: We need to ensure `compilePlanToCode` actually *uses* the repair loop properly. Currently `compilePlanToCode` calls `runQualityGates` but seemingly just warns related to retries (logic at line 191-203). It needs to use `generateRepairPrompt`.

## 3. Patch-Based Modification (P0 Bugfix)
**Goal**: Stop full-file rewrites. Use deterministic JSON patches.
**Current Status**: `applyPlanToExistingHtml` requests full HTML.
**Plan**:
1.  **Create `applyPatchToHtml`**: A function that takes JSON patches and applies them.
2.  **Update `applyPlanToExistingHtml`**:
    - Change prompt to `PATCH_PROMPT`.
    - Expect JSON output.
    - Call `applyPatchToHtml`.
    - Fallback to Full Rewrite only if Redesign is requested/approved.

## Execution Steps
1.  **Refine Quality Gates**: Fix the retry loop in `compilePlanToCode` to use `generateRepairPrompt` instead of just re-running with a slightly stricter prompt.
2.  **Implement Patch Engine**: Add `applyPatches` and the new `PATCH_PROMPT`.
3.  **Wire Memory**: Inject memory into `compilePlanToCode` and `applyPlanToExistingHtml` prompts. Hook up extraction.
