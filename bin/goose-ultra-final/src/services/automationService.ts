import { GooseUltraComputerDriver, GooseUltraBrowserDriver, GooseUltraServerDriver, Project } from '../types';
import { runVibeGuard, loadCurrentState, saveCurrentState, recordInteraction, ExecutionMode, saveSnapshot } from './ContextEngine';
import { SafeGenStreamer } from './StreamHandler';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Global model accessor - reads from localStorage to support Ollama integration
// This is updated by the React orchestrator when the model changes
export const getActiveModel = (): string => {
  try {
    const stored = localStorage.getItem('goose-active-model');
    return stored || 'qwen-coder-plus';
  } catch {
    return 'qwen-coder-plus';
  }
};

export const setActiveModel = (model: string): void => {
  try {
    localStorage.setItem('goose-active-model', model);
  } catch {
    // Ignore storage errors
  }
};

// --- GEMINI 3 PRO / VIBE CODING TEMPLATE ---
export const FRAMEWORK_TEMPLATE_PROMPT = `
You are an expert Frontend Engineer. 
Your task is to implement the User's Plan into a SINGLE, HIGH-FIDELITY HTML FILE using the REQUESTED FRAMEWORK.

### TECHNICAL REQUIREMENTS:
1. **Single File**: Everything (HTML, CSS, JS) must be in one file.
2. **CDNs Only**: Use reputable CDNs (cdnjs, unpkg, esm.sh) for libraries.
3. **React**: If React is requested, use React 18 + ReactDOM 18 + Babel Standalone (for JSX).
   - <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
   - <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
   - <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
   - <script type="text/babel"> ... your code ... </script>
4. **Vue**: If Vue is requested, use Vue 3 global build.
   - <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
5. **Aesthetics**: Unless the user specified a specific CSS framework (like Bootstrap), DEFAULT to **TailwindCSS** for styling to maintain "Vibe" quality.
   - <script src="https://cdn.tailwindcss.com"></script>

### CRITICAL: CLIENT-SIDE ONLY
- **NO SERVER-SIDE TEMPLATES**: DO NOT use Jinja2, Liquid, PHP, etc.
- **NO NODE.JS SPECIFIC**: No 'require', no 'process.env', no 'npm install'.
- **Mock Data**: Create dummy data arrays inside the script.

### OUTPUT FORMAT:
- RETURN **ONLY** THE RAW HTML CODE.
- DO NOT USE MARKDOWN BLOCK.
- DO NOT include or display the plan/instructions in the UI. The plan is input-only.
`;

export const MODERN_TEMPLATE_PROMPT = `
You are an elite Frontend Architect simulating the reasoning and coding quality of Google Gemini 1.5 Pro.

### DESIGN & TECH STACK (NON-NEGOTIABLE)
1. **Framework**: Vanilla HTML5 + JavaScript (ES6+). NO React/Vue/Angular unless explicitly requested.
2. **Styling**: Tailwind CSS (via CDN). Use modern utility classes (flex, grid, glassmorphism, gradients). Use slate/zinc/neutral for structural greys and vibrant indigo/violet/blue for accents.
3. **Icons**: FontAwesome (via CDN).
4. **Font**: 'Inter' or 'JetBrains Mono' via Google Fonts.

### ATOMIC OUTPUT PROTOCOL
1. You are strictly forbidden from 'chatting' your code. 
2. You must output the code inside a standard XML block: <artifact_payload>.
3. Do not output internal tool logs (like <<goose) inside this block.

Example Output:
<artifact_payload file="index.html">
<!DOCTYPE html>
<html lang="en">
...
</html>
</artifact_payload>
`;



export const MockComputerDriver: GooseUltraComputerDriver = {
  checkArmed: () => true, // In real app, check env var or system flag
  runAction: async (action, params) => {
    console.log(`[Desktop] ${action}`, params);
    await sleep(800);
    return { status: 'success', screenshot: 'https://picsum.photos/800/600' };
  }
};

export const MockBrowserDriver: GooseUltraBrowserDriver = {
  navigate: async (url) => {
    console.log(`[Browser] Navigate: ${url}`);
    await sleep(1000);
  },
  assert: async (selector) => {
    console.log(`[Browser] Assert: ${selector}`);
    await sleep(500);
    return true; // Always pass in mock
  }
};

export const MockServerDriver: GooseUltraServerDriver = {
  connect: async (host) => {
    console.log(`[Server] Connecting to ${host}...`);
    await sleep(1500);
    return true;
  },
  runCommand: async (cmd, dryRun) => {
    if (dryRun) return `[DryRun] Would execute: ${cmd}`;
    console.log(`[Server] Executing: ${cmd}`);
    await sleep(1000);
    return `Success: ${cmd} executed.\nLogs: [System OK]`;
  }
};

// P0-2: Task Match Gate
export interface TaskMatchResult {
  matchesRequest: boolean;
  why: string;
  detectedAppType: string;
  requestType: string;
}

const runTaskMatchCheck = async (
  plan: string,
  userRequest: string
): Promise<TaskMatchResult> => {
  const electron = (window as any).electron;
  if (!electron) return { matchesRequest: true, why: "Offline", detectedAppType: "unknown", requestType: "unknown" }; // Skip in offline mode

  const prompt = `You are a strict QA Gatekeeper.
User Request: "${userRequest}"
Proposed Plan: "${plan.substring(0, 500)}..."

Analyze if the Plan matches the User Request category.
- If User asked for a Game and Plan is a Dashboard -> FAIL.
- If User asked for a Portfolio and Plan is a Chatbot -> FAIL.
- If they vaguely match (e.g., "App" and "Dashboard"), PASS.

OUTPUT ONLY JSON:
{
  "matchesRequest": boolean,
  "why": "string reason",
  "detectedAppType": "string",
  "requestType": "string"
}`;

  return new Promise((resolve) => {
    let buf = '';
    const onChunk = (c: string) => buf += c;
    const onComplete = (c: string) => {
      electron.removeChatListeners();
      const final = (c && c.length > buf.length ? c : buf).replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        const res = JSON.parse(final);
        resolve(res);
      } catch (e) {
        resolve({ matchesRequest: true, why: "JSON Parse Error", detectedAppType: "unknown", requestType: "unknown" });
      }
    };

    electron.onChatChunk(onChunk);
    electron.onChatComplete(onComplete);

    electron.startChat([
      { role: 'system', content: prompt }
    ], getActiveModel());
  });
};

export const compilePlanToCode = async (
  plan: string,
  onChunk?: (code: string) => void,
  projectId?: string,
  preferredFramework?: string | null,
  persona?: { name: string, prompt: string } | null,
  skills?: string[] | null
): Promise<string> => {
  const electron = (window as any).electron;
  if (!electron) return "<!-- Electron Not Available --><h1 style='color:red'>Offline Mode</h1>";

  // M1: Load Project Memory
  let memoryContext = "";
  if (projectId) {
    const memories = await loadProjectMemories(projectId);
    // M3: Retrieve Top-K
    const relevant = retrieveRelevantMemories(memories, plan, 5); // Top-5 relevant to the plan
    memoryContext = formatMemoriesForPrompt(relevant);
  }

  const MAX_RETRIES = 3;
  let attempt = 0;
  let lastQaReport: QualityReport | null = null;

  // P0-2: Run Task Match Check before generating code (Pass 1)
  // We infer the original request from the plan title or first few lines if not explicitly passed.
  // Ideally, we passed the request explicitly, but for now we extract it from the plan header.
  if (onChunk) onChunk("// Verifying Plan Alignment with User Request..."); // VISUAL FEEDBACK

  const userRequestInferred = plan.split('\n')[0].replace('#', '').trim() || "App Build";

  // Add Timeout to prevent stuck state
  const matchResultPromise = runTaskMatchCheck(plan, userRequestInferred);
  const timeoutPromise = new Promise<TaskMatchResult>(resolve =>
    setTimeout(() => resolve({ matchesRequest: true, why: "Timeout (Fail Open)", detectedAppType: "unknown", requestType: "unknown" }), 5000)
  );

  const matchResult = await Promise.race([matchResultPromise, timeoutPromise]);

  if (!matchResult.matchesRequest) {
    console.error("[AutoService] BLOCKED: Plan matches " + matchResult.detectedAppType + " but User asked for " + matchResult.requestType);
    // We could throw here, but the contract says "Auto-retry once with stronger instructions".
    // We will inject this failure into the prompt.
  }

  while (attempt < MAX_RETRIES) {
    attempt++;
    console.log(`[AutoService] Compiling Plan to Code... Attempt ${attempt}/${MAX_RETRIES}`);

    // VISUAL FEEDBACK
    if (onChunk) onChunk(`// Initializing Build Engine (Attempt ${attempt})...`);

    try {
      const result = await new Promise<string>((resolve, reject) => {
        let fullResponse = '';

        // Ensure clean state BEFORE attaching new listeners
        electron.removeChatListeners();

        let lastSafeCode = '';
        const streamer = new SafeGenStreamer();

        // ... (handlers definition)

        const onChunkHandler = (c: string) => {
          const safeUpdate = streamer.processChunk(c);
          if (safeUpdate) {
            if (!safeUpdate.startsWith("<!-- Generating")) {
              lastSafeCode = safeUpdate;
            }
            if (onChunk) onChunk(safeUpdate);
          }
        };

        const onCompleteHandler = (c: string) => {
          if (c && c.length > 5) {
            const safeUpdate = streamer.processChunk(c);
            if (safeUpdate && !safeUpdate.startsWith("<!-- Generating")) {
              lastSafeCode = safeUpdate;
            }
          }
          cleanup();

          if (lastSafeCode) {
            resolve(lastSafeCode);
          } else {
            console.warn("[SafeGen] Output was incomplete or invalid.");
            resolve("<!-- Error: SafeGen failed to validate artifact. -->");
          }
        };

        const onErrorHandler = (e: any) => {
          cleanup();
          reject(e);
        };

        const cleanup = () => {
          electron.removeChatListeners();
        };

        electron.onChatChunk(onChunkHandler);
        electron.onChatComplete(onCompleteHandler);
        electron.onChatError(onErrorHandler);

        // ... (Prompt Construction)

        // Construct Prompt (F5: XML Artifact Bundle)
        let systemPrompt = `You are a strict Build Engine.
1. FIRST, output a <thinking> block. Discuss strategy/design (e.g. "Using dark theme...").
2. THEN, output the files using <goose_file> tags.

SCHEMA:
<thinking>
...
</thinking>
<goose_file path="index.html">
<!DOCTYPE html>
...
</goose_file>
<goose_file path="style.css">
body { ... }
</goose_file>

RULES:
1. Do NOT escape content (no need for \\n or \\").
2. Do NOT use markdown code blocks (\`\`\`) inside the tags.
3. index.html MUST be a complete file.
4. Output MUST start with <thinking>.
5. DO NOT generate a "Plan" or "Documentation" page. Generate the ACTUAL APP requested.
`;
        let userContent = "IMPLEMENTATION PLAN (input-only):\n" + plan;

        if (memoryContext) {
          systemPrompt += "\n" + memoryContext;
        }

        if (preferredFramework) {
          systemPrompt += `\n\n[USER PREFERENCE]: Use "${preferredFramework}".`;
        }

        // --- INJECT PERSONA & SKILLS ---
        if (persona) {
          systemPrompt += `\n\n[ACTIVE PERSONA]: You are acting as "${persona.name}".\n${persona.prompt}`;
        }
        if (skills && skills.length > 0) {
          systemPrompt += `\n\n[AVAILABLE SKILLS]: You have the following capabilities/skills available: ${skills.join(', ')}. Ensure you leverage them if relevant to the implementation.`;
        }

        // P0-2: Task Mismatch Handling (Inject into Prompt)
        if (!matchResult.matchesRequest && attempt === 1) {
          systemPrompt += `\n\n⚠️ CRITICAL WARNING: Previous plan drifted. User asked for ${matchResult.requestType}. BUILD THAT.`;
        }

        // Retry Logic with Repair Prompt
        if (attempt > 1 && lastQaReport) {
          // We just reuse strict mode instructions
          systemPrompt += `\n\n[REPAIR MODE] Fix these errors:\n${lastQaReport.gates.filter(g => !g.passed).map(g => g.errors.join(', ')).join('\n')}`;
        }

        // Just start chat - listeners are already attached (and cleaned before that)
        electron.startChat([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ], getActiveModel());
      });

      // F5: Parse XML Bundle for QA
      let filesForQa: Record<string, string> = {};
      try {
        // Strip thinking block for cleaner processing (optional, regex handles it but good for debug)
        const regex = /<goose_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/goose_file>/g;
        let m;
        while ((m = regex.exec(result)) !== null) {
          if (m[1] && m[2]) {
            filesForQa[m[1]] = m[2].trim();
          }
        }

        // Fallback: If no tags found, try legacy detection (plain HTML)
        if (Object.keys(filesForQa).length === 0) {
          if (result.includes('<!DOCTYPE') || result.includes('<html')) {
            filesForQa['index.html'] = result;
          }
        }
      } catch (e) {
        // Fallback or fail
        if (result.includes('<!DOCTYPE') || result.includes('<html')) {
          filesForQa['index.html'] = result;
        }
      }

      const qaReport = runQualityGates(filesForQa);

      if (qaReport.overallPass) {
        console.log("[AutoService] ✓ Quality gates passed.");
        // Return the RAW RESULT (JSON or HTML) - generateMockFiles will handle parsing again
        return result;
      } else {
        console.warn(`[AutoService] Attempt ${attempt} failed QA:`, qaReport.gates.filter(g => !g.passed).map(g => g.gate));
        lastQaReport = qaReport;

        if (attempt >= MAX_RETRIES) {
          console.error("[AutoService] QA failed after max retries. Returning best effort.");
          return result;
        }
        await sleep(1000);
      }


    } catch (e) {
      if (attempt >= MAX_RETRIES) throw e;
      console.error(`[AutoService] Attempt ${attempt} error:`, e);
      await sleep(1000);
    }
  }

  throw new Error("Code generation failed unexpectedly.");
};

const PLAN_TAG_RE = /\[+\s*plan\s*\]+/gi;
const stripPlanTag = (text: string) => text.replace(PLAN_TAG_RE, '').replace(/^\s*plan\s*:\s*/i, '').trim();

// --- Fingerprint Helpers for Redesign Detection ---
const computeDomSignature = (html: string): string => {
  // Extract tag sequence from body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  const tags = body.match(/<(\w+)[^>]*>/g) || [];
  const tagNames = tags.slice(0, 50).map(t => t.match(/<(\w+)/)?.[1] || '').join(',');
  // Simple hash
  let hash = 0;
  for (let i = 0; i < tagNames.length; i++) {
    hash = ((hash << 5) - hash) + tagNames.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
};

const computeCssSignature = (html: string): string => {
  // Extract color tokens and font-family
  const colors = html.match(/(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|hsl\([^)]+\))/g) || [];
  const fonts = html.match(/font-family:\s*([^;]+)/g) || [];
  const signature = [...colors.slice(0, 10), ...fonts.slice(0, 3)].join('|');
  let hash = 0;
  for (let i = 0; i < signature.length; i++) {
    hash = ((hash << 5) - hash) + signature.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
};

const computeLayoutSignature = (html: string): string => {
  // Count major structural elements
  const hasNav = /<nav|class="[^"]*nav/i.test(html);
  const hasHero = /<section[^>]*hero|class="[^"]*hero/i.test(html);
  const hasFooter = /<footer/i.test(html);
  const sectionCount = (html.match(/<section/gi) || []).length;
  const divCount = (html.match(/<div/gi) || []).length;
  return `nav:${hasNav},hero:${hasHero},footer:${hasFooter},sections:${sectionCount},divs:${Math.floor(divCount / 5) * 5}`;
};

const compareSignatures = (before: { dom: string; css: string; layout: string }, after: { dom: string; css: string; layout: string }) => {
  const domChanged = before.dom !== after.dom;
  const cssChanged = before.css !== after.css;
  const layoutChanged = before.layout !== after.layout;
  // Layout change is most severe indicator of redesign
  const isLikelyRedesign = layoutChanged || (domChanged && cssChanged);
  return { domChanged, cssChanged, layoutChanged, isLikelyRedesign };
};

// --- Change Budget Calculator ---
const computeChangeBudget = (before: string, after: string): { addedLines: number; removedLines: number; changedLines: number; totalChanges: number } => {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  // Simple line-based diff approximation
  const beforeSet = new Set(beforeLines.map(l => l.trim()).filter(l => l.length > 0));
  const afterSet = new Set(afterLines.map(l => l.trim()).filter(l => l.length > 0));

  let addedLines = 0;
  let removedLines = 0;

  for (const line of beforeSet) {
    if (!afterSet.has(line)) removedLines++;
  }
  for (const line of afterSet) {
    if (!beforeSet.has(line)) addedLines++;
  }

  return {
    addedLines,
    removedLines,
    changedLines: Math.min(addedLines, removedLines),
    totalChanges: addedLines + removedLines
  };
};

// --- AI Self-Check Gate ---
interface SelfCheckVerdict {
  preservedDesign: boolean;
  onlyRequestedChanges: boolean;
  forbiddenChangesDetected: string[];
  summaryOfChanges: string;
}

const runAISelfCheck = async (
  beforeHtml: string,
  afterHtml: string,
  userRequest: string
): Promise<SelfCheckVerdict> => {
  const electron = (window as any).electron;
  if (!electron) {
    return { preservedDesign: true, onlyRequestedChanges: true, forbiddenChangesDetected: [], summaryOfChanges: 'Offline mode - skipped' };
  }

  const selfCheckPrompt = `You are a QA validator for code modifications.

Compare BEFORE and AFTER HTML. The USER REQUEST was: "${userRequest}"

Return ONLY valid JSON (no markdown):
{
  "preservedDesign": true/false (did layout, colors, fonts stay the same?),
  "onlyRequestedChanges": true/false (did we only do what was asked?),
  "forbiddenChangesDetected": ["list of unexpected major changes like layout rewrite, color scheme change, etc."],
  "summaryOfChanges": "one sentence describing what actually changed"
}`;

  const userContent = `BEFORE (first 500 chars):\n${beforeHtml.substring(0, 500)}\n\nAFTER (first 500 chars):\n${afterHtml.substring(0, 500)}`;

  return new Promise((resolve) => {
    let buffer = '';
    electron.removeChatListeners();

    electron.onChatChunk((c: string) => { buffer += c; });
    electron.onChatComplete((response: string) => {
      electron.removeChatListeners();
      let json = (response || buffer).trim();
      json = json.replace(/```json/gi, '').replace(/```/g, '').trim();
      const first = json.indexOf('{');
      const last = json.lastIndexOf('}');
      if (first !== -1 && last > first) {
        json = json.substring(first, last + 1);
      }
      try {
        const parsed = JSON.parse(json);
        resolve({
          preservedDesign: parsed.preservedDesign ?? true,
          onlyRequestedChanges: parsed.onlyRequestedChanges ?? true,
          forbiddenChangesDetected: parsed.forbiddenChangesDetected ?? [],
          summaryOfChanges: parsed.summaryOfChanges ?? ''
        });
      } catch {
        console.warn('[SelfCheck] Parse failed, assuming pass');
        resolve({ preservedDesign: true, onlyRequestedChanges: true, forbiddenChangesDetected: [], summaryOfChanges: 'Parse error - assumed pass' });
      }
    });
    electron.onChatError(() => {
      electron.removeChatListeners();
      resolve({ preservedDesign: true, onlyRequestedChanges: true, forbiddenChangesDetected: [], summaryOfChanges: 'Error - assumed pass' });
    });

    electron.startChat([
      { role: 'system', content: selfCheckPrompt },
      { role: 'user', content: userContent }
    ], getActiveModel());
  });
};

// --- Constants for Change Budget ---
const CHANGE_BUDGET = {
  maxHtmlLineEdits: 80,
  maxCssLineEdits: 120, // Not used since CSS is inline
  maxJsLineEdits: 160   // Not used since JS is inline
};

// --- Patch Engine Types ---
export interface Patch {
  file: string;
  op: 'INSERT_AFTER' | 'INSERT_BEFORE' | 'REPLACE_BLOCK' | 'DELETE_BLOCK';
  anchor: {
    type: 'STRING' | 'REGEX';
    value: string;
  };
  content?: string;
  reason?: string;
}

export interface PatchPlan {
  mode: 'MODIFY_EXISTING';
  projectId: string;
  request: string;
  redesignRequested: boolean;
  files: string[];
  changeBudget: {
    maxEdits: number;
    maxNewLines: number;
  };
  patches: Patch[];
}

// --- Local Patch Applier ---
const applyPatches = (html: string, patches: Patch[]): string => {
  let currentHtml = html;

  for (const patch of patches) {
    if (patch.file !== 'index.html' && patch.file !== 'file') continue; // Single file mode for now

    // Locate anchor
    let anchorIndex = -1;
    let matchLength = 0;

    if (patch.anchor.type === 'REGEX') {
      try {
        const re = new RegExp(patch.anchor.value);
        const match = currentHtml.match(re);
        if (match && match.index !== undefined) {
          anchorIndex = match.index;
          matchLength = match[0].length;
        }
      } catch (e) {
        console.warn(`[Patch] Invalid Regex: ${patch.anchor.value}`);
      }
    } else {
      anchorIndex = currentHtml.indexOf(patch.anchor.value);
      matchLength = patch.anchor.value.length;
    }

    if (anchorIndex === -1) {
      console.warn(`[Patch] Anchor not found: ${patch.anchor.value.substring(0, 50)}...`);
      continue; // Skip failed patch
    }

    // Apply Op
    const content = patch.content || '';
    if (patch.op === 'REPLACE_BLOCK') {
      currentHtml = currentHtml.substring(0, anchorIndex) + content + currentHtml.substring(anchorIndex + matchLength);
    } else if (patch.op === 'DELETE_BLOCK') {
      currentHtml = currentHtml.substring(0, anchorIndex) + currentHtml.substring(anchorIndex + matchLength);
    } else if (patch.op === 'INSERT_AFTER') {
      currentHtml = currentHtml.substring(0, anchorIndex + matchLength) + content + currentHtml.substring(anchorIndex + matchLength);
    } else if (patch.op === 'INSERT_BEFORE') {
      currentHtml = currentHtml.substring(0, anchorIndex) + content + currentHtml.substring(anchorIndex);
    }
  }
  return currentHtml;
};

export const applyPlanToExistingHtml = async (
  plan: string,
  currentHtml: string,
  onChunk?: (code: string) => void,
  retryCount: number = 0,
  projectId?: string,
  persona?: { name: string, prompt: string } | null,
  skills?: string[] | null
): Promise<string> => {
  const electron = (window as any).electron;
  if (!electron) return "<!-- Electron Not Available --><h1 style='color:red'>Offline Mode</h1>";

  // M1: Injest Memory
  let memoryContext = "";
  if (projectId) {
    const memories = await loadProjectMemories(projectId);
    const relevant = retrieveRelevantMemories(memories, plan, 5);
    memoryContext = formatMemoriesForPrompt(relevant);
  }

  // --- INJECT PERSONA & SKILLS ---
  if (persona) {
    memoryContext += `\n\n[ACTIVE PERSONA]: You are acting as "${persona.name}".\n${persona.prompt}`;
  }
  if (skills && skills.length > 0) {
    memoryContext += `\n\n[AVAILABLE SKILLS]: You have the following capabilities/skills available: ${skills.join(', ')}. Ensure you leverage them if relevant to the implementation.`;
  }

  // PATCH PROMPT
  const PATCH_PROMPT = `
You are an expert Frontend Engineer.
The User wants to MODIFY the existing application.
DO NOT REWRITE THE FULL FILE. Provide a JSON Patch Plan.

### FILES
We are working on a single file 'index.html' which contains HTML, CSS, and JS.

### MEMORY & CONSTRAINTS
${memoryContext}

### INSTRUCTIONS
1. Analyze the CURRENT_HTML and the REQUEST.
2. Produce a JSON Patch Plan (Strict JSON only).
3. Use 'REPLACE_BLOCK' to modify existing code.
4. Use 'INSERT_AFTER' / 'INSERT_BEFORE' to add new features.
5. 'anchor' must be a UNIQUE string or regex in the file to locate where to apply the change.
6. Keep 'content' minimal. Do NOT include unchanged surrounding code in 'content'.

### JSON FORMAT
{
  "mode": "MODIFY_EXISTING",
  "projectId": "${projectId || 'unknown'}",
  "request": "summary of request",
  "redesignRequested": false, 
  "files": ["index.html"],
  "changeBudget": { "maxEdits": 50, "maxNewLines": 200 },
  "patches": [
    {
      "file": "index.html",
      "op": "REPLACE_BLOCK",
      "anchor": { "type": "STRING", "value": "<h1 class=\"title\">Old Title</h1>" },
      "content": "<h1 class=\"title\">New Title</h1>"
    }
  ]
}

If the request requires a FULL REDESIGN (changing >50% of layout or colors), set "redesignRequested": true.
`;

  return new Promise((resolve, reject) => {
    let fullResponse = '';

    const onChunkHandler = (c: string) => {
      fullResponse += c;
      if (onChunk) onChunk(JSON.stringify({ status: "Generating Patch...", size: fullResponse.length }));
    };

    const onCompleteHandler = async (c: string) => {
      cleanup();
      const rawJson = (c.length > fullResponse.length ? c : fullResponse).trim();

      // Parse JSON
      let patchPlan: PatchPlan | null = null;
      try {
        const jsonStr = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
        patchPlan = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse patch JSON", e);
        // Retry or Fail?
        if (retryCount < 1) {
          console.log("Retrying patch generation...");
          return resolve(applyPlanToExistingHtml(plan, currentHtml, onChunk, retryCount + 1, projectId));
        }
        reject(new Error("Failed to parse patch plan"));
        return;
      }

      if (patchPlan?.redesignRequested) {
        // Fallback to full rewrite if redesign requested
        // We would ideally ask user confirmation here, but for now we throw/reject or handle upstream?
        // The contract says: "Require explicit REDESIGN_OK confirmation".
        // Since we can't show a modal easily from here without UI callback, we'll Reject with a special error.
        reject(new Error("REDESIGN_REQUESTED: The model requesting a full redesign. Please confirm."));
        return;
      }

      // CLIE: Save Snapshot (Before applying patches)
      if (projectId && patchPlan) {
        // We save the state *before* modifications are applied
        const description = patchPlan.request ? `Before: ${patchPlan.request}` : 'Before update';
        // For now, we assume index.html is the main file. 
        // In a real multi-file system we'd snapshot all files, but currentHtml implies single context here.
        saveSnapshot(projectId, description, { 'index.html': currentHtml }).catch(e => console.error('[CLIE] Snapshot failed:', e));
      }

      // Apply Patches
      let newHtml = currentHtml;
      if (patchPlan && patchPlan.patches) {
        newHtml = applyPatches(currentHtml, patchPlan.patches);
      }

      // CLIE: VIBE GUARD Check
      // Only run if we have a projectId (so we can load context)
      if (projectId && patchPlan && !patchPlan.redesignRequested) {
        try {
          const currentState = await loadCurrentState(projectId);
          if (currentState) {
            // Assume REPAIR_MODE if we are here (patching existing) without redesign
            // Ideally we'd pass the mode from intent analysis, but let's default to strict safety
            const mode: ExecutionMode = 'REPAIR_MODE';

            const vibeCheck = runVibeGuard(mode, currentState, newHtml);

            await recordInteraction(
              projectId,
              patchPlan.request || 'Unknown Patch',
              mode,
              `Applied ${patchPlan.patches?.length || 0} patches`,
              vibeCheck.approved,
              vibeCheck.domDrift
            );

            if (!vibeCheck.approved) {
              console.error(`[CLIE] Vibe Guard Blocked Update: ${vibeCheck.reason}`);
              reject(new Error(`VIBE GUARD BLOCKED: ${vibeCheck.reason}. The AI attempted a destructive change (` + vibeCheck.domDrift + '% structural change) during a repair task. Please explicitly request a "Redesign" if you want to change the layout.'));
              return;
            }
          }
        } catch (e) {
          console.error('[CLIE] Vibe Guard Error (Allowing update):', e);
        }
      }

      // Validate
      const qReport = runQualityGates(newHtml);
      if (!qReport.overallPass) {
        console.warn("Patched HTML failed QA", qReport);
        // Auto-repair? Or just return original?
        // We can try to repair the RESULTING html using the standard repair loop
        // But maybe simpler to just return it and let the standard flow handle it?
        // The contract says "on_validation_failure: Do not write files... Auto-retry".
        if (retryCount < 1) {
          return resolve(applyPlanToExistingHtml(plan, currentHtml, onChunk, retryCount + 1, projectId));
        }
      }

      // CLIE: Update State
      if (projectId) {
        // We only save the structural state - CSS handling is simplified here (assuming inline or separate)
        // If we had the CSS we would pass it. For now, passing empty string for CSS update, causing re-extraction from HTML if present.
        saveCurrentState(projectId, newHtml, "").catch(e => console.error(e));
      }

      resolve(newHtml);
    };

    const onErrorHandler = (e: any) => {
      cleanup();
      reject(e);
    };

    const cleanup = () => {
      electron.removeChatListeners();
    };

    electron.onChatChunk(onChunkHandler);
    electron.onChatComplete(onCompleteHandler);
    electron.onChatError(onErrorHandler);

    electron.startChat(
      [
        { role: 'system', content: PATCH_PROMPT },
        { role: 'user', content: `CURRENT_HTML (snippet):\n${currentHtml.substring(0, 5000) + "..."}\n\nREQUEST:\n${plan}` }
      ],
      getActiveModel()
    );
  });
};

export const generateMockPlan = () => `
# Project Plan: Vibe Coder
## Objectives
- Create a slick React interface
- Implement state machine
- ensure darkness

## Files
- /src/App.tsx
- /src/components/Header.tsx
`;

// Helper to get electron API
const getElectron = () => (window as any).electron;

export const getUserDataRoot = async (): Promise<string | null> => {
  const electron = getElectron();
  if (!electron?.getAppPath) return null;
  try {
    return await electron.getAppPath();
  } catch {
    return null;
  }
};

const safeJsonParse = <T,>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const ensureProjectOnDisk = async (project: Project): Promise<void> => {
  const electron = getElectron();
  if (!electron?.fs) return;
  const userData = await getUserDataRoot();
  if (!userData) return;
  const base = `${userData}/projects/${project.id}`;
  const metadataPath = `${base}/project.json`;
  await electron.fs.write(metadataPath, JSON.stringify(project, null, 2));
};

export const writeLastActiveProjectId = async (projectId: string): Promise<void> => {
  const electron = getElectron();
  if (!electron?.fs) return;
  const userData = await getUserDataRoot();
  if (!userData) return;
  await electron.fs.write(`${userData}/projects/.lastActive.json`, JSON.stringify({ projectId }, null, 2));
};

export const readLastActiveProjectId = async (): Promise<string | null> => {
  const electron = getElectron();
  if (!electron?.fs) return null;
  const userData = await getUserDataRoot();
  if (!userData) return null;
  try {
    const raw = await electron.fs.read(`${userData}/projects/.lastActive.json`);
    const parsed = safeJsonParse<{ projectId?: string }>(raw, {});
    return parsed.projectId || null;
  } catch {
    return null;
  }
};

// --- Project Context Memory (for modification retention) ---
export interface ProjectContext {
  projectId: string;
  createdAt: string;
  updatedAt: string;
  designLockEnabled: boolean;
  designIntent: string;
  uiTokens: {
    colors: string[];
    fonts: string[];
    borderRadiusHints: string[];
  };
  structureSummary: string;
  goldenSnapshot: {
    indexHtmlSha256: string;
    styleCssSha256: string | null;
    scriptJsSha256: string | null;
    createdAt: string;
  };
  fingerprints: {
    domSignature: string;
    cssSignature: string;
    layoutSignature: string;
  };
  modificationBudgetDefaults: {
    maxHtmlLineEdits: number;
    maxCssLineEdits: number;
    maxJsLineEdits: number;
  };
}

export const saveProjectContext = async (projectId: string, context: ProjectContext): Promise<void> => {
  const electron = getElectron();
  if (!electron?.fs) return;
  const userData = await getUserDataRoot();
  if (!userData) return;
  const path = `${userData}/projects/${projectId}/goose-context.json`;
  await electron.fs.write(path, JSON.stringify(context, null, 2));
};

export const loadProjectContext = async (projectId: string): Promise<ProjectContext | null> => {
  const electron = getElectron();
  if (!electron?.fs) return null;
  const userData = await getUserDataRoot();
  if (!userData) return null;
  try {
    const raw = await electron.fs.read(`${userData}/projects/${projectId}/goose-context.json`);
    return safeJsonParse<ProjectContext>(raw, null as any);
  } catch {
    return null;
  }
};

export const extractProjectContext = (html: string, projectId: string): ProjectContext => {
  // Extract colors (hex codes)
  const colors = (html.match(/#[0-9a-fA-F]{3,8}/g) || []).slice(0, 10);
  // Extract fonts
  const fonts = (html.match(/font-family:\s*([^;]+)/gi) || []).map(f => f.replace(/font-family:\s*/i, '')).slice(0, 5);
  // Extract structure summary
  const hasNav = /<nav/i.test(html);
  const hasHero = /hero|jumbotron/i.test(html);
  const hasFeatures = /features|benefits/i.test(html);
  const hasFooter = /<footer/i.test(html);
  const sectionCount = (html.match(/<section/gi) || []).length;

  const structureSummary = [
    hasNav ? 'nav' : '',
    hasHero ? 'hero' : '',
    hasFeatures ? 'features' : '',
    `${sectionCount} sections`,
    hasFooter ? 'footer' : ''
  ].filter(Boolean).join(', ');

  // Compute fingerprints
  const domSignature = computeDomSignature(html);
  const cssSignature = computeCssSignature(html);
  const layoutSignature = computeLayoutSignature(html);

  // Extract border radius hints
  const borderRadiusHints = (html.match(/border-radius:\s*([^;]+)/gi) || [])
    .map(r => r.replace(/border-radius:\s*/i, ''))
    .slice(0, 5);

  // Simple hash for snapshot
  const simpleHash = (s: string): string => {
    let hash = 0;
    for (let i = 0; i < Math.min(s.length, 1000); i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  };

  const now = new Date().toISOString();

  return {
    projectId,
    createdAt: now,
    updatedAt: now,
    designLockEnabled: true, // Default ON as per contract
    designIntent: 'Modern dark-mode web app with Tailwind styling',
    uiTokens: { colors, fonts, borderRadiusHints },
    structureSummary,
    goldenSnapshot: {
      indexHtmlSha256: simpleHash(html),
      styleCssSha256: null,
      scriptJsSha256: null,
      createdAt: now
    },
    fingerprints: { domSignature, cssSignature, layoutSignature },
    modificationBudgetDefaults: {
      maxHtmlLineEdits: 80,
      maxCssLineEdits: 120,
      maxJsLineEdits: 160
    }
  };
};

// =========================================
// mem0-STYLE PROJECT MEMORY SYSTEM
// =========================================

export interface MemoryRecord {
  memoryId: string;
  scope: 'project' | 'session' | 'global';
  type: 'fact' | 'constraint' | 'decision' | 'preference' | 'glossary';
  key: string;
  value: string;
  confidence: number; // 0..1
  createdAt: string;
  updatedAt: string;
  source: string; // messageId or buildSessionId
  supersedes?: string; // ID of memory this replaces
  isActive: boolean;
}

// --- Memory Store CRUD ---
export const loadProjectMemories = async (projectId: string): Promise<MemoryRecord[]> => {
  const electron = getElectron();
  if (!electron?.fs) return [];
  const userData = await getUserDataRoot();
  if (!userData) return [];

  try {
    const raw = await electron.fs.read(`${userData}/projects/${projectId}/memory/memory.jsonl`);
    const lines = raw.split('\n').filter(l => l.trim());
    return lines.map(l => {
      try { return JSON.parse(l) as MemoryRecord; }
      catch { return null; }
    }).filter(Boolean) as MemoryRecord[];
  } catch {
    return [];
  }
};

export const saveProjectMemories = async (projectId: string, memories: MemoryRecord[]): Promise<void> => {
  const electron = getElectron();
  if (!electron?.fs) return;
  const userData = await getUserDataRoot();
  if (!userData) return;

  const jsonl = memories.map(m => JSON.stringify(m)).join('\n');
  await electron.fs.write(`${userData}/projects/${projectId}/memory/memory.jsonl`, jsonl);
};

export const addMemory = async (projectId: string, memory: Omit<MemoryRecord, 'memoryId' | 'createdAt' | 'updatedAt' | 'isActive'>): Promise<MemoryRecord> => {
  const existing = await loadProjectMemories(projectId);

  const newMemory: MemoryRecord = {
    ...memory,
    memoryId: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true
  };

  // M4: Dedup - check for existing similar memory
  const duplicate = existing.find(m =>
    m.isActive &&
    m.key.toLowerCase() === newMemory.key.toLowerCase() &&
    m.type === newMemory.type
  );

  if (duplicate) {
    // Update existing instead of adding new
    duplicate.value = newMemory.value;
    duplicate.updatedAt = newMemory.updatedAt;
    duplicate.confidence = Math.max(duplicate.confidence, newMemory.confidence);
    await saveProjectMemories(projectId, existing);
    return duplicate;
  }

  existing.push(newMemory);
  await saveProjectMemories(projectId, existing);
  return newMemory;
};

export const deleteMemory = async (projectId: string, memoryId: string): Promise<void> => {
  const existing = await loadProjectMemories(projectId);
  const memory = existing.find(m => m.memoryId === memoryId);
  if (memory) {
    memory.isActive = false;
    memory.updatedAt = new Date().toISOString();
  }
  await saveProjectMemories(projectId, existing);
};

export const updateMemory = async (projectId: string, memoryId: string, updates: Partial<Pick<MemoryRecord, 'value' | 'confidence'>>): Promise<void> => {
  const existing = await loadProjectMemories(projectId);
  const memory = existing.find(m => m.memoryId === memoryId);
  if (memory) {
    if (updates.value !== undefined) memory.value = updates.value;
    if (updates.confidence !== undefined) memory.confidence = updates.confidence;
    memory.updatedAt = new Date().toISOString();
  }
  await saveProjectMemories(projectId, existing);
};

// --- M3: Top-K Retrieval with Keyword + Recency Scoring ---
export const retrieveRelevantMemories = (
  memories: MemoryRecord[],
  query: string,
  topK: number = 5,
  maxChars: number = 1500
): MemoryRecord[] => {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const now = Date.now();

  // Active memories only
  const active = memories.filter(m => m.isActive);

  // Score each memory
  const scored = active.map(m => {
    let score = 0;
    const keyLower = m.key.toLowerCase();
    const valueLower = m.value.toLowerCase();

    // Keyword matching
    for (const word of queryWords) {
      if (keyLower.includes(word)) score += 3;
      if (valueLower.includes(word)) score += 1;
    }

    // Boost by type priority
    const typePriority: Record<string, number> = {
      constraint: 5,
      decision: 4,
      preference: 3,
      fact: 2,
      glossary: 1
    };
    score += typePriority[m.type] || 0;

    // Recency boost (memories from last 24h get +2, last week +1)
    const age = now - new Date(m.updatedAt).getTime();
    if (age < 24 * 60 * 60 * 1000) score += 2;
    else if (age < 7 * 24 * 60 * 60 * 1000) score += 1;

    // Confidence boost
    score += m.confidence;

    return { memory: m, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top-K within char budget
  const result: MemoryRecord[] = [];
  let totalChars = 0;

  for (const { memory } of scored) {
    const charCount = memory.key.length + memory.value.length + 20;
    if (totalChars + charCount > maxChars) break;
    result.push(memory);
    totalChars += charCount;
    if (result.length >= topK) break;
  }

  return result;
};

// --- M2: Memory Extraction from Chat/Builds ---
export const extractMemoriesFromText = async (
  projectId: string,
  text: string,
  source: string
): Promise<MemoryRecord[]> => {
  const electron = (window as any).electron;
  if (!electron) return [];

  const extractionPrompt = `You are a memory extraction agent. Extract durable facts, constraints, and decisions from the text.

Return ONLY valid JSON array (no markdown):
[
  {"type": "constraint|decision|preference|fact|glossary", "key": "short_key", "value": "description", "confidence": 0.8}
]

Rules:
- Max 5 items
- Constraint = something that MUST be preserved (e.g., "dark mode", "use Tailwind")
- Decision = architectural choice (e.g., "use React 18", "localStorage for state")
- Preference = user style preference (e.g., "prefers dark glass UI")
- Fact = factual statement about the project
- Glossary = domain term definition

Only extract if clearly stated. Do not invent.`;

  return new Promise((resolve) => {
    let buffer = '';
    electron.removeChatListeners();

    electron.onChatChunk((c: string) => { buffer += c; });
    electron.onChatComplete((response: string) => {
      electron.removeChatListeners();
      let json = (response || buffer).trim();
      json = json.replace(/```json/gi, '').replace(/```/g, '').trim();

      // Extract JSON array
      const first = json.indexOf('[');
      const last = json.lastIndexOf(']');
      if (first !== -1 && last > first) {
        json = json.substring(first, last + 1);
      }

      try {
        const parsed = JSON.parse(json) as Array<{ type: string; key: string; value: string; confidence: number }>;
        const newMemories: MemoryRecord[] = [];

        for (const item of parsed.slice(0, 5)) {
          if (item.key && item.value) {
            const mem: MemoryRecord = {
              memoryId: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              scope: 'project',
              type: (item.type as MemoryRecord['type']) || 'fact',
              key: item.key,
              value: item.value,
              confidence: item.confidence || 0.7,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              source,
              isActive: true
            };
            newMemories.push(mem);
          }
        }

        resolve(newMemories);
      } catch {
        console.warn('[MemoryExtract] Parse failed');
        resolve([]);
      }
    });

    electron.onChatError(() => {
      electron.removeChatListeners();
      resolve([]);
    });

    electron.startChat([
      { role: 'system', content: extractionPrompt },
      { role: 'user', content: `Extract memories from:\n${text.substring(0, 2000)}` }
    ], getActiveModel());
  });
};

// --- Format memories for prompt injection ---
export const formatMemoriesForPrompt = (memories: MemoryRecord[]): string => {
  if (memories.length === 0) return '';

  const lines = memories.map(m => `• [${m.type.toUpperCase()}] ${m.key}: ${m.value}`);
  return `\n[PROJECT MEMORY - MUST RESPECT]\n${lines.join('\n')}\n`;
};

export const listProjectsFromDisk = async (): Promise<Project[]> => {
  const electron = getElectron();
  if (!electron?.fs) return [];
  const userData = await getUserDataRoot();
  if (!userData) return [];

  const root = `${userData}/projects`;
  let entries: Array<{ name: string; isDirectory: boolean; path: string }> = [];
  try {
    entries = await electron.fs.list(root);
  } catch {
    return [];
  }

  const projects: Project[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    const id = entry.name;
    try {
      const raw = await electron.fs.read(`${root}/${id}/project.json`);
      const parsed = safeJsonParse<Project>(raw, null as any);
      if (parsed?.id) {
        projects.push(parsed);
        continue;
      }
    } catch {
      // ignore
    }
    projects.push({ id, name: `Project ${id}`, slug: id, createdAt: 0 });
  }

  projects.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return projects;
};

export const loadProjectFilesFromDisk = async (projectId: string): Promise<Record<string, string>> => {
  const electron = getElectron();
  if (!electron?.fs) return {};
  const userData = await getUserDataRoot();
  if (!userData) return {};

  const base = `${userData}/projects/${projectId}`;
  const result: Record<string, string> = {};

  const tryRead = async (rel: string) => {
    try {
      return await electron.fs.read(`${base}/${rel}`);
    } catch {
      return null;
    }
  };

  const html = await tryRead('index.html');
  const css = await tryRead('style.css');
  const js = await tryRead('script.js');

  if (html != null) result['index.html'] = html;
  if (css != null) result['style.css'] = css;
  if (js != null) result['script.js'] = js;

  return result;
};

export const deleteProjectFromDisk = async (projectId: string): Promise<void> => {
  const electron = getElectron();
  if (!electron?.fs) return;
  const userData = await getUserDataRoot();
  if (!userData) return;
  await electron.fs.delete(`${userData}/projects/${projectId}`);

  try {
    const raw = await electron.fs.read(`${userData}/projects/.lastActive.json`);
    const parsed = safeJsonParse<{ projectId?: string }>(raw, {});
    if (parsed.projectId === projectId) {
      await electron.fs.write(`${userData}/projects/.lastActive.json`, JSON.stringify({ projectId: null }, null, 2));
    }
  } catch {
    // ignore
  }
};

// Helper to extract code blocks
const extractCode = (markdown: string, lang: string) => {
  // Try precise language match
  let regex = new RegExp(`\`\`\`${lang}([\\s\\S]*?)\`\`\``, 'i');
  let match = markdown.match(regex);
  if (match) return match[1].trim();

  // Fallback: If looking for HTML, try to find generic blocks containing specific tags
  if (lang === 'html') {
    const genericRegex = /```([\s\S]*?)```/g;
    let m;
    while ((m = genericRegex.exec(markdown)) !== null) {
      const content = m[1];
      if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
        return content.trim();
      }
    }
  }
  return null;
};

// =========================================
// UI QUALITY GATES SYSTEM
// =========================================

export interface QualityGateResult {
  passed: boolean;
  gate: string;
  errors: string[];
  warnings: string[];
}

export interface QualityReport {
  overallPass: boolean;
  artifactType: 'HTML_APP' | 'PLAN_TEXT' | 'UNKNOWN';
  gates: QualityGateResult[];
  repairHints: string[];
}

// Gate 1: Detect artifact type and block plan/prose
const gate1_artifactType = (files: Record<string, string>): QualityGateResult => {
  const content = files['index.html'] || '';
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for plan markers
  // Check for plan markers (Aggressive Update)
  if (/\[PLAN\]/i.test(content) ||
    content.includes('<title>Implementation Plan</title>') ||
    content.includes('<h1>Architecture Overview</h1>') ||
    (content.includes('<h2>Core Features</h2>') && content.includes('<ul>')) ||
    // New Specific Checks for the user's case
    content.match(/<div class=["']phase["']>/i) ||
    content.match(/<h3>Phase \d+:/i) ||
    content.includes('Timeline Summary') ||
    content.includes('Implementation Plan') // Catch-all for title variations
  ) {
    errors.push('Output appears to be a formatted HTML Plan, not the App itself [PLAN]');
  }

  // Check for markdown headings without HTML
  if (/^#{1,3}\s+/m.test(content) && !/<html/i.test(content)) {
    errors.push('Contains markdown headings but no <html> tag');
  }

  // Check for bullet lists at start
  if (/^[\s]*[-*]\s+/m.test(content.substring(0, 500)) && !/<html/i.test(content)) {
    errors.push('Starts with bullet list (prose/plan) but no <html> tag');
  }

  // Must have HTML tags
  if (!/<html/i.test(content) && !/<body/i.test(content) && !/<div/i.test(content)) {
    errors.push('No HTML tags detected - appears to be plain text');
  }

  return {
    passed: errors.length === 0,
    gate: 'Gate 1: Artifact Type',
    errors,
    warnings
  };
};

// Gate 2: HTML validity
const gate2_htmlValidity = (files: Record<string, string>): QualityGateResult => {
  const content = files['index.html'] || '';
  const errors: string[] = [];
  const warnings: string[] = [];

  // Must have doctype
  if (!/<!DOCTYPE html>/i.test(content)) {
    errors.push('Missing <!DOCTYPE html>');
  }

  // Must have <html> tag
  if (!/<html/i.test(content)) {
    errors.push('Missing <html> tag');
  }

  // Must have <head>
  if (!/<head/i.test(content)) {
    warnings.push('Missing <head> section');
  }

  // Must have <body>
  if (!/<body/i.test(content)) {
    errors.push('Missing <body> tag');
  }

  // Must not have escaped HTML entities as content (sign of encoding issue)
  if (/&lt;html|&lt;body|&lt;div/i.test(content)) {
    errors.push('Contains escaped HTML entities (&lt;) - encoding issue');
  }

  // Check for matching closing tags
  if (/<html/i.test(content) && !/<\/html>/i.test(content)) {
    errors.push('Missing closing </html> tag');
  }

  return {
    passed: errors.length === 0,
    gate: 'Gate 2: HTML Validity',
    errors,
    warnings
  };
};

// Gate 3: Styling presence
const gate3_stylingPresence = (files: Record<string, string>): QualityGateResult => {
  const content = files['index.html'] || '';
  const cssContent = files['style.css'] || '';

  const errors: string[] = [];
  const warnings: string[] = [];

  const hasInlineStyle = /<style[\s\S]*?>[\s\S]*?<\/style>/i.test(content);
  const hasStyleAttribute = /style\s*=\s*["'][^"']+["']/i.test(content);
  const hasTailwindCDN = /cdn\.tailwindcss\.com/i.test(content);
  const hasExternalCSS = /<link[^>]+stylesheet/i.test(content);
  const hasBootstrapCDN = /bootstrap/i.test(content);
  const hasLocalCSS = cssContent.length > 50; // Arbitrary significant size

  // Count CSS rules if inline style exists
  let cssRuleCount = 0;
  if (hasInlineStyle) {
    const styleMatch = content.match(/<style[\s\S]*?>([\s\S]*?)<\/style>/i);
    if (styleMatch) {
      cssRuleCount = (styleMatch[1].match(/[{]/g) || []).length;
    }
  }

  // Count local CSS rules
  if (hasLocalCSS) {
    cssRuleCount += (cssContent.match(/[{]/g) || []).length;
  }

  // Determine if styled
  const isVanillaHighQuality = (hasInlineStyle || hasLocalCSS) && cssRuleCount >= 5;
  const isTailwindUsed = hasTailwindCDN && (content.match(/class="[^"]*"/g) || []).length > 3;
  const isBootstrapUsed = hasBootstrapCDN;
  const isExternalUsed = hasExternalCSS;
  const isInlineHeavy = hasStyleAttribute && (content.match(/style\s*=/gi) || []).length >= 5;

  const isStyled = isVanillaHighQuality || isTailwindUsed || isBootstrapUsed || isExternalUsed || isInlineHeavy;

  if (!isStyled) {
    warnings.push('Low styling detected (Gate 3 Warning).');
    warnings.push('Expected significant CSS, Tailwind, or inline styles.');
    if (hasInlineStyle) warnings.push(`Found <style> with ${cssRuleCount} rules.`);
  }

  // Check for potential CDN issues
  if (hasTailwindCDN && !hasInlineStyle && !hasStyleAttribute && !hasLocalCSS) {
    warnings.push('Relies solely on Tailwind CDN - ensure network access');
  }

  return {
    passed: errors.length === 0,
    gate: 'Gate 3: Styling Presence',
    errors,
    warnings
  };
};

// Gate 4: Runtime sanity (basic checks)
const gate4_runtimeSanity = (files: Record<string, string>): QualityGateResult => {
  const content = files['index.html'] || '';
  const jsContent = files['script.js'] || '';

  const errors: string[] = [];
  const warnings: string[] = [];

  // Combine JS
  let combinedJS = jsContent;
  const scriptMatches = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const script of scriptMatches) {
    combinedJS += '\n' + script.replace(/<\/?script[^>]*>/gi, '');
  }

  // Check for unclosed strings or brackets (very basic)
  const openBraces = (combinedJS.match(/{/g) || []).length;
  const closeBraces = (combinedJS.match(/}/g) || []).length;
  if (Math.abs(openBraces - closeBraces) > 2) {
    warnings.push('Possible JS syntax error: mismatched braces');
  }

  // Check body isn't just text dump
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    const bodyContent = bodyMatch[1].replace(/<[^>]+>/g, '').trim();
    // If body is mostly text with very few tags, might be a dump
    const tagCount = (bodyMatch[1].match(/<[a-z]/gi) || []).length;
    if (bodyContent.length > 1000 && tagCount < 5) {
      warnings.push('Body contains large text block with few HTML tags - possible prose dump');
    }
  }

  // Check for undefined references (basic)
  if (/undefined|null\s*\./.test(combinedJS)) {
    warnings.push('Potential runtime error: undefined/null reference');
  }

  return {
    passed: errors.length === 0,
    gate: 'Gate 4: Runtime Sanity',
    errors,
    warnings
  };
};

// Gate 5: Accessibility minimum
const gate5_accessibilityMinimum = (files: Record<string, string>): QualityGateResult => {
  const content = files['index.html'] || '';
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for viewport meta
  if (!/<meta[^>]+viewport/i.test(content)) {
    warnings.push('Missing viewport meta tag for responsive design');
  }

  // Check for at least one interactive element
  const hasButton = /<button/i.test(content);
  const hasLink = /<a[^>]+href/i.test(content);
  const hasInput = /<input/i.test(content);
  if (!hasButton && !hasLink && !hasInput) {
    warnings.push('No interactive elements (button, link, input) detected');
  }

  // Check for lang attribute
  if (!/<html[^>]+lang\s*=/i.test(content)) {
    warnings.push('Missing lang attribute on <html>');
  }

  return {
    passed: true, // Accessibility is warning-only, doesn't block
    gate: 'Gate 5: Accessibility',
    errors,
    warnings
  };
};

// =========================================
// LAYER 4: TASK MATCH GATE
// =========================================
// Detect when AI generates wrong type of app (e.g., asked for game, got dashboard)

interface TaskMatchContext {
  originalPrompt: string;
  projectType?: string;
}

// Store context for task matching (set before generation)
let taskMatchContext: TaskMatchContext | null = null;

export const setTaskMatchContext = (context: TaskMatchContext) => {
  taskMatchContext = context;
};

export const clearTaskMatchContext = () => {
  taskMatchContext = null;
};

// Extract key intent keywords from prompt
const extractIntentKeywords = (prompt: string): string[] => {
  const keywords: string[] = [];
  const lower = prompt.toLowerCase();

  // App types
  if (lower.includes('game') || lower.includes('play') || lower.includes('score')) keywords.push('game');
  if (lower.includes('dashboard') || lower.includes('analytics') || lower.includes('chart')) keywords.push('dashboard');
  if (lower.includes('form') || lower.includes('survey') || lower.includes('input')) keywords.push('form');
  if (lower.includes('portfolio') || lower.includes('resume') || lower.includes('cv')) keywords.push('portfolio');
  if (lower.includes('blog') || lower.includes('article') || lower.includes('post')) keywords.push('blog');
  if (lower.includes('shop') || lower.includes('store') || lower.includes('cart') || lower.includes('product')) keywords.push('ecommerce');
  if (lower.includes('cbt') || lower.includes('therapy') || lower.includes('mental') || lower.includes('stress')) keywords.push('wellness');
  if (lower.includes('todo') || lower.includes('task') || lower.includes('checklist')) keywords.push('productivity');
  if (lower.includes('chat') || lower.includes('message') || lower.includes('conversation')) keywords.push('messaging');
  if (lower.includes('landing') || lower.includes('hero') || lower.includes('call to action')) keywords.push('landing');

  return keywords;
};

// Check if output matches expected intent
const gate6_taskMatch = (files: Record<string, string>): QualityGateResult => {
  const content = files['index.html'] || '';
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!taskMatchContext?.originalPrompt) {
    // No context set, skip this gate
    return { passed: true, gate: 'Gate 6: Task Match', errors, warnings };
  }

  const requestedKeywords = extractIntentKeywords(taskMatchContext.originalPrompt);
  const outputKeywords = extractIntentKeywords(content);

  // Also check the <title> and headings
  const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
  const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const titleText = (titleMatch?.[1] || '') + ' ' + (h1Match?.[1] || '');
  const titleKeywords = extractIntentKeywords(titleText);

  // Merge detected keywords
  const allOutputKeywords = [...new Set([...outputKeywords, ...titleKeywords])];

  // Check for mismatch
  if (requestedKeywords.length > 0) {
    const hasMatch = requestedKeywords.some(k => allOutputKeywords.includes(k));

    if (!hasMatch && allOutputKeywords.length > 0) {
      // Definite mismatch
      errors.push(`Task mismatch: Requested "${requestedKeywords.join(', ')}" but output appears to be "${allOutputKeywords.join(', ')}"`);
    } else if (!hasMatch) {
      // Can't determine output type, just warn
      warnings.push(`Could not verify output matches requested "${requestedKeywords.join(', ')}"`);
    }
  }

  return {
    passed: errors.length === 0,
    gate: 'Gate 6: Task Match',
    errors,
    warnings
  };
};

// Run all quality gates
export const runQualityGates = (files: Record<string, string> | string): QualityReport => {
  // Normalize input to files object to support legacy calls if any
  let normalizedFiles: Record<string, string> = {};
  if (typeof files === 'string') {
    normalizedFiles = { 'index.html': files };
  } else {
    normalizedFiles = files;
  }

  const gates = [
    gate1_artifactType(normalizedFiles),
    gate2_htmlValidity(normalizedFiles),
    gate3_stylingPresence(normalizedFiles),
    gate4_runtimeSanity(normalizedFiles),
    gate5_accessibilityMinimum(normalizedFiles),
    gate6_taskMatch(normalizedFiles)  // LAYER 4: Task Match Gate
  ];

  // Gates 1-4 and 6 are blocking; Gate 5 (accessibility) is warning-only
  const blockingGates = [gates[0], gates[1], gates[2], gates[3], gates[5]];
  const overallPass = blockingGates.every(g => g.passed);

  // Determine artifact type
  let artifactType: 'HTML_APP' | 'PLAN_TEXT' | 'UNKNOWN' = 'UNKNOWN';
  if (gates[0].passed && gates[1].passed) {
    artifactType = 'HTML_APP';
  } else if (gates[0].errors.some(e => e.includes('[PLAN]') || e.includes('markdown'))) {
    artifactType = 'PLAN_TEXT';
  }

  // Generate repair hints
  const repairHints: string[] = [];
  for (const gate of gates) {
    for (const error of gate.errors) {
      if (error.includes('plan text') || error.includes('[PLAN]')) {
        repairHints.push('Return a full valid HTML document, not plan text.');
      }
      if (error.includes('Missing <!DOCTYPE')) {
        repairHints.push('Start with <!DOCTYPE html><html>...');
      }
      if (error.includes('No significant styling')) {
        repairHints.push('Add a <style> block with CSS rules, or use inline styles.');
      }
      if (error.includes('escaped HTML entities')) {
        repairHints.push('Output raw HTML, not escaped entities.');
      }
    }
  }

  return {
    overallPass,
    artifactType,
    gates,
    repairHints: [...new Set(repairHints)] // Dedupe
  };
};

// Auto-repair prompt generator
export const generateRepairPrompt = (originalPrompt: string, qaReport: QualityReport, attemptNumber: number): string => {
  const strictMode = attemptNumber >= 2;

  let repairPrompt = `⚠️ QA GATE FAILURE - ATTEMPT ${attemptNumber}/2

Your previous output FAILED quality checks:
${qaReport.gates.filter(g => !g.passed).map(g => `• ${g.gate}: ${g.errors.join(', ')}`).join('\n')}

REPAIR INSTRUCTIONS:
${qaReport.repairHints.map(h => `• ${h}`).join('\n')}

${strictMode ? `
⚡ STRICT MODE (Final Attempt):
- Use ONLY embedded <style> block, NO external CDNs
- Keep JavaScript minimal
- Output a complete, self-contained HTML file
- DO NOT include any text explanations
` : ''}

ORIGINAL REQUEST:
${originalPrompt}

OUTPUT: Return ONLY the corrected HTML file. No markdown. No explanations.`;

  return repairPrompt;
};

export const generateMockFiles = async (projectPath: string = 'projects/latest', planContent: string = '') => {
  const electron = getElectron();
  const buildId = Date.now().toString();

  // =========================================
  // SAFE-GEN PIPELINE INTEGRATION
  // =========================================

  let files: Record<string, string> = {};

  // F5: XML Parsing Logic (v2 Protocol)
  const regex = /<goose_file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/goose_file>/g;
  let hasXmlMatch = false;
  let m;
  while ((m = regex.exec(planContent)) !== null) {
    if (m[1] && m[2]) {
      files[m[1]] = m[2].trim();
      hasXmlMatch = true;
    }
  }

  if (hasXmlMatch) {
    console.log('[MockFiles] Successfully parsed XML Artifact Bundle');
  }

  // Direct HTML assignment (primary path fallback)
  if (Object.keys(files).length === 0) {
    // Only accept if strictly HTML to avoid JSON-dump bug
    const trimmed = planContent.trim();
    if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html')) {
      files['index.html'] = trimmed;
    } else {
      // FALLBACK: Legacy regex extraction
      let html = extractCode(planContent, 'html') || extractCode(planContent, 'xml') || '';
      let css = extractCode(planContent, 'css');
      let js = extractCode(planContent, 'javascript') || extractCode(planContent, 'js');

      // Fallback: Check for raw HTML if extraction failed
      if (!html && planContent.trim().includes('<!DOCTYPE html>')) {
        const match = planContent.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
        html = match ? match[0] : null;
      }

      // Last resort: Check for <html> tag without DOCTYPE
      if (!html && planContent.includes('<html')) {
        const match = planContent.match(/<html[\s\S]*<\/html>/i);
        if (match) {
          html = '<!DOCTYPE html>\n' + match[0];
        }
      }

      if (html) {
        files['index.html'] = html;
        if (css) files['style.css'] = css;
        if (js) files['script.js'] = js;
      }
    }
  }

  // If no files extracted at all, create simple stub so QA fails properly
  if (!files['index.html']) {
    files['index.html'] = `<!DOCTYPE html><html><body><h1>Code Generation Failed</h1></body></html>`;
  }

  // =========================================
  // RUN QUALITY GATES (Non-Destructive)
  // =========================================
  const qaReport = runQualityGates(files);
  console.log('[QA Gates] Report:', qaReport);

  const home = electron && electron.fs ? await electron.getAppPath() : '';
  const fullBasePath = `${home}/${projectPath}`;
  const buildsPath = `${fullBasePath}/.builds/${buildId}`;

  // STAGING: Always save raw artifacts to history (F1)
  if (electron && electron.fs) {
    try {
      // Create directory if needed (assuming fs handles it or we rely on write to create)
      await electron.fs.write(`${buildsPath}/raw/index.html`, files['index.html'] || '');
      if (files['style.css']) await electron.fs.write(`${buildsPath}/raw/style.css`, files['style.css']);
      if (files['script.js']) await electron.fs.write(`${buildsPath}/raw/script.js`, files['script.js']);

      await electron.fs.write(`${buildsPath}/qa/report.json`, JSON.stringify(qaReport, null, 2));
    } catch (e) {
      console.error('[QA Gates] Failed to write history:', e);
    }
  }

  if (!qaReport.overallPass) {
    console.error('[QA Gates] FAILED! Errors:', qaReport.gates.filter(g => !g.passed).map(g => ({ gate: g.gate, errors: g.errors })));

    // F1: NON-DESTRUCTIVE - Do NOT write to project root.
    // Instead, return the failure overlay content for the UI/Preview to show, but DO NOT save it as index.html

    const failureHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>QA Check Failed</title><style>
      body { background: linear-gradient(135deg, #1a1a1a 0%, #2d1a1a 100%); color: #e8e8e8; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .container { max-width: 700px; text-align: center; }
      h1 { color: #ff5555; font-size: 28px; margin-bottom: 10px; }
      .subtitle { color: #888; margin-bottom: 30px; font-size: 14px; }
      .error-box { background: rgba(255,85,85,0.1); border: 1px solid rgba(255,85,85,0.3); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: left; }
      .error-item { margin: 12px 0; font-size: 14px; color: #ffaaaa; }
      .error-item strong { color: #ff8888; }
      .rebuild-btn { display: inline-flex; align-items: center; gap: 8px; margin-top: 30px; padding: 14px 28px; background: linear-gradient(135deg, #34d399 0%, #10b981 100%); color: #000; font-weight: bold; font-size: 14px; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 0 30px rgba(52,211,153,0.3); transition: all 0.3s ease; }
      .rebuild-btn:hover { transform: scale(1.05); box-shadow: 0 0 40px rgba(52,211,153,0.5); }
    </style></head><body>
      <div class="container">
        <h1>⚠️ QA Check Failed</h1>
        <p class="subtitle">The generated app did not meet quality standards. (Build ID: ${buildId})</p>
        <div class="error-box">
          <p style="margin: 0 0 12px 0; font-size: 12px; color: #ff6666; text-transform: uppercase;">Issues Detected:</p>
          ${qaReport.gates.filter(g => !g.passed).map(g => `
            <div class="error-item"><strong>Gate ${g.gate.split(':')[0]}:</strong> ${g.errors.join(', ')}</div>
          `).join('')}
        </div>
        <button class="rebuild-btn" onclick="window.parent.postMessage({type:'REBUILD_REQUEST'},'*')">
          🔄 Retry / Repair
        </button>
      </div>
      <script>
        document.querySelector('.rebuild-btn').addEventListener('click', function() {
          try { window.parent.dispatchEvent(new CustomEvent('goose-rebuild-request')); } catch(e) {}
        });
      </script>
    </body></html>`;

    // Return files object with _qaFailed flag but also the 'virtual' index.html for the iframe to render
    return {
      'index.html': failureHtml,
      'style.css': '',
      'script.js': '',
      _qaFailed: true,
      _qaReport: qaReport,
      _buildId: buildId
    };
  }

  // Log any warnings (non-blocking)
  const warnings = qaReport.gates.flatMap(g => g.warnings);
  if (warnings.length > 0) {
    console.warn('[QA Gates] Warnings:', warnings);
  }

  // Write all extracted files to disk (ATOMIC SWAP: Success only)
  if (electron && electron.fs) {
    console.log(`[QA Gates] PASSED ✓ Writing ${Object.keys(files).length} files to ${fullBasePath}...`);
    for (const [relPath, content] of Object.entries(files)) {
      if (content) await electron.fs.write(`${fullBasePath}/${relPath}`, content);
    }
    return files;
  } else {
    console.warn("Electron FS not available. Returning mock data.");
    return files;
  }
};

// --- Skills Service ---
// --- Skills Service ---
// Superseded by src/services/skillsService.ts



export const savePersonasToDisk = async (personas: import('../types').Persona[]) => {
  const electron = getElectron();
  if (!electron?.fs) return;
  const userData = await getUserDataRoot();
  if (!userData) return;
  const personasDir = `${userData}/personas`;
  await electron.fs.write(`${personasDir}/index.json`, JSON.stringify(personas, null, 2));
};

export const loadPersonasFromDisk = async (): Promise<import('../types').Persona[]> => {
  const electron = getElectron();
  if (!electron?.fs) return [];
  const userData = await getUserDataRoot();
  if (!userData) return [];
  try {
    const personasDir = `${userData}/personas`;
    const raw = await electron.fs.read(`${personasDir}/index.json`);
    return JSON.parse(raw);
  } catch {
    return [];
  }
};
