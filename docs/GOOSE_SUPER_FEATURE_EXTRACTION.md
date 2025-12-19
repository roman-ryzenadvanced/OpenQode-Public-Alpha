# 📦 FEATURE EXTRACTION MAP - Reference Projects

> What specific code/patterns to take from each project for Goose Super

---

## 1. Windows-Use (CursorTouch)
**Repo:** https://github.com/CursorTouch/Windows-Use

### What They Have
```
windows_use/
├── agent/          # Agent orchestration loop
├── llms/           # LLM provider abstraction (Ollama, Google, OpenAI)
├── messages/       # Conversation/message handling
├── tool/           # Tool definitions for automation
└── telemetry/      # Usage analytics
```

### What We Take

| Feature | Their File | Our Implementation |
|---------|------------|-------------------|
| **UIAutomation element finder** | `tool/uia.py` | Port to `computer-use.cjs` |
| **Element grounding (labeling)** | `tool/grounding.py` | New `services/GroundingService.js` |
| **Smart click by name** | `tool/actions.py` | Enhance `input.ps1 uiclick` |
| **LLM abstraction layer** | `llms/*.py` | New `services/LLMService.js` |
| **Agent loop pattern** | `agent/agent.py` | Enhance `lib/iq-exchange.mjs` |

### Specific Code to Port

```python
# FROM: windows_use/tool/uia.py - UIAutomation element discovery
def find_element_by_name(name: str, control_type: str = None):
    """Find UI element using Windows Accessibility API"""
    automation = UIAutomation.GetRootElement()
    condition = automation.CreatePropertyCondition(
        UIA.NamePropertyId, name
    )
    if control_type:
        condition = automation.CreateAndCondition(
            condition,
            automation.CreatePropertyCondition(
                UIA.ControlTypePropertyId, control_type
            )
        )
    return automation.FindFirst(TreeScope.Descendants, condition)
```

**Port to Node.js/PowerShell:**
```powershell
# Enhanced input.ps1 - find_element function
function Find-ElementByName {
    param([string]$Name, [string]$ControlType = $null)
    
    Add-Type -AssemblyName UIAutomationClient
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $condition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::NameProperty, 
        $Name
    )
    return $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
}
```

### Grounding System (Label Elements on Screenshot)

```python
# FROM: windows_use/tool/grounding.py
def create_grounding_map(screenshot_path):
    """Overlay element labels on screenshot for AI understanding"""
    elements = get_all_interactive_elements()
    labeled_image = draw_labels_on_screenshot(screenshot_path, elements)
    return {
        "image": labeled_image,
        "elements": [
            {"id": i, "name": el.name, "type": el.type, "bounds": el.rect}
            for i, el in enumerate(elements)
        ]
    }
```

---

## 2. Open-Interface (AmberSahdev)
**Repo:** https://github.com/AmberSahdev/Open-Interface

### What They Have
```
app/
├── core.py         # Main loop: screenshot → LLM → execute → verify
├── interpreter.py  # Parse LLM response into actions
├── llm.py          # LLM communication
├── ui.py           # Tkinter UI (18KB)
└── utils/          # Helpers
```

### What We Take

| Feature | Their File | Our Implementation |
|---------|------------|-------------------|
| **Screenshot → Execute → Verify loop** | `core.py` | Enhance IQ Exchange loop |
| **Action interpreter/parser** | `interpreter.py` | Improve `extractExecutables()` |
| **Corner detection (interrupt)** | `ui.py` | Add to Electron app |
| **Course-correction logic** | `core.py` | Add to self-heal flow |

### Specific Code to Port

```python
# FROM: app/core.py - Main automation loop
class AutomationCore:
    def run_task(self, user_request):
        while not self.task_complete and self.attempts < self.max_attempts:
            # 1. Capture current state
            screenshot = self.capture_screen()
            
            # 2. Send to LLM with context
            response = self.llm.analyze(
                screenshot=screenshot,
                request=user_request,
                previous_actions=self.action_history
            )
            
            # 3. Parse and execute actions
            actions = self.interpreter.parse(response)
            for action in actions:
                result = self.executor.run(action)
                self.action_history.append(result)
            
            # 4. Verify progress
            new_screenshot = self.capture_screen()
            progress = self.llm.verify_progress(screenshot, new_screenshot, user_request)
            
            if progress.is_complete:
                self.task_complete = True
            elif progress.is_stuck:
                self.attempts += 1
                # Self-correction: ask LLM for alternative approach
```

**Port to our IQ Exchange:**
```javascript
// Enhanced lib/iq-exchange.mjs
async process(userRequest) {
    while (!this.taskComplete && this.attempts < this.maxRetries) {
        // 1. Screenshot current state
        const before = await this.captureScreen();
        
        // 2. Get AI instructions
        const response = await this.sendToAI(
            this.buildPromptWithVision(userRequest, before, this.history)
        );
        
        // 3. Execute
        const actions = this.extractExecutables(response);
        for (const action of actions) {
            await this.executeAny(action.content);
        }
        
        // 4. Verify
        const after = await this.captureScreen();
        const verified = await this.verifyProgress(before, after, userRequest);
        
        if (verified.complete) {
            this.taskComplete = true;
        } else if (verified.stuck) {
            this.attempts++;
            // Request alternative approach
        }
    }
}
```

### Mouse Corner Interrupt

```python
# FROM: app/ui.py - Corner detection to stop automation
def check_corner_interrupt(self):
    """Stop if user drags mouse to corner (safety interrupt)"""
    x, y = pyautogui.position()
    screen_w, screen_h = pyautogui.size()
    
    corners = [
        (0, 0), (screen_w, 0),
        (0, screen_h), (screen_w, screen_h)
    ]
    
    for cx, cy in corners:
        if abs(x - cx) < 50 and abs(y - cy) < 50:
            self.stop_automation()
            return True
    return False
```

---

## 3. Browser-Use
**Repo:** https://github.com/browser-use/browser-use

### What They Have (Most Comprehensive!)
```
browser_use/
├── agent/          # Agent service and logic
├── browser/        # Playwright wrapper with smart features
├── controller/     # Action controller
├── dom/            # DOM analysis and manipulation
├── code_use/       # Code execution sandbox
├── filesystem/     # File operations
├── tools/          # Custom tool definitions
├── skills/         # Reusable action patterns
├── sandbox/        # Safe execution environment
├── llm/            # LLM integrations
└── mcp/            # Model Context Protocol
```

### What We Take

| Feature | Their File | Our Implementation |
|---------|------------|-------------------|
| **Smart DOM extraction** | `dom/` | New `services/DOMService.js` |
| **Element selectors by text** | `browser/element.py` | Enhance `playwright-bridge.js` |
| **Multi-tab management** | `browser/session.py` | Add to browser panel |
| **Tools decorator pattern** | `tools/registry.py` | New tool registration system |
| **Sandbox execution** | `sandbox/` | Safe code runner |
| **Form auto-detection** | `dom/forms.py` | Auto-fill capability |
| **Smart waiting** | `browser/waits.py` | Better wait logic |

### Specific Code to Port

```python
# FROM: browser_use/dom/extractor.py - Smart DOM extraction
class DOMExtractor:
    def extract_interactive_elements(self, page):
        """Extract all clickable/fillable elements with smart selectors"""
        return page.evaluate('''() => {
            const elements = [];
            const interactive = document.querySelectorAll(
                'a, button, input, select, textarea, [role="button"], [onclick]'
            );
            
            for (let i = 0; i < interactive.length; i++) {
                const el = interactive[i];
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    elements.push({
                        index: i,
                        tag: el.tagName.toLowerCase(),
                        text: el.textContent?.trim().slice(0, 50) || '',
                        placeholder: el.placeholder || '',
                        id: el.id,
                        name: el.name,
                        type: el.type,
                        selector: generateUniqueSelector(el),
                        rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
                    });
                }
            }
            return elements;
        }''')
```

**Port to our Playwright bridge:**
```javascript
// Enhanced bin/playwright-bridge.js
async function extractInteractiveElements(page) {
    return await page.evaluate(() => {
        const elements = [];
        const selectors = 'a, button, input, select, textarea, [role="button"], [onclick]';
        document.querySelectorAll(selectors).forEach((el, i) => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                elements.push({
                    index: i,
                    tag: el.tagName.toLowerCase(),
                    text: (el.textContent || '').trim().slice(0, 50),
                    placeholder: el.placeholder || '',
                    ariaLabel: el.getAttribute('aria-label') || '',
                    selector: el.id ? `#${el.id}` : generateSelector(el),
                    rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
                });
            }
        });
        return elements;
    });
}
```

### Custom Tools Pattern

```python
# FROM: browser_use/tools/registry.py
from browser_use import Tools

tools = Tools()

@tools.action(description='Search for something on Google')
async def google_search(query: str):
    await browser.navigate('https://google.com')
    await browser.fill('input[name="q"]', query)
    await browser.press('Enter')
    return await browser.get_content()
```

**Port to our system:**
```javascript
// New: lib/tools-registry.js
class ToolsRegistry {
    constructor() {
        this.tools = new Map();
    }
    
    register(name, description, handler) {
        this.tools.set(name, { description, handler });
    }
    
    async execute(name, params) {
        const tool = this.tools.get(name);
        if (!tool) throw new Error(`Unknown tool: ${name}`);
        return await tool.handler(params);
    }
    
    getSchema() {
        return Array.from(this.tools.entries()).map(([name, tool]) => ({
            name,
            description: tool.description
        }));
    }
}

// Register tools
tools.register('google_search', 'Search Google', async ({ query }) => {
    await playwright.navigate('https://google.com');
    await playwright.fill('input[name="q"]', query);
    await playwright.press('Enter');
});
```

---

## 4. VS Code / Monaco Editor
**Repo:** https://github.com/microsoft/vscode

### What They Have
```
VS Code is massive! We only need:
├── monaco-editor            # Core editor component (npm package)
├── Language services        # IntelliSense for JS/TS/CSS/HTML
└── TextMate grammars        # Syntax highlighting definitions
```

### What We Take

| Feature | Their Package | Our Implementation |
|---------|---------------|-------------------|
| **Monaco Editor** | `monaco-editor` npm | Embed in Electron |
| **Language services** | Built into Monaco | Enable for JS/TS/CSS/HTML |
| **File tree UI** | Custom | Build our own simple tree |
| **Multi-tab** | Custom | Build tabbed interface |

### Implementation

```javascript
// Install
npm install monaco-editor

// Embed in Electron (renderer)
import * as monaco from 'monaco-editor';

// Configure for web languages
monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false
});

// Create editor
const editor = monaco.editor.create(document.getElementById('editor-container'), {
    value: '// Start coding...',
    language: 'javascript',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    wordWrap: 'on'
});

// Listen for changes
editor.onDidChangeModelContent(() => {
    const code = editor.getValue();
    // Auto-save or trigger preview refresh
});
```

---

## 5. Goose (Block)
**Repo:** https://github.com/block/goose

### What They Have
```
crates/
├── goose-cli/      # CLI interface
├── goose-server/   # Web server
├── goose/          # Core agent logic
└── mcp-*/          # Model Context Protocol extensions

ui/                 # Web UI (React)
documentation/      # Recipes and guides
```

### What We Take

| Feature | Their Location | Our Implementation |
|---------|----------------|-------------------|
| **Recipe system** | `documentation/recipes/` | Project templates |
| **Session management** | `crates/goose/session.rs` | Session persistence |
| **Multi-agent support** | `crates/goose/agent.rs` | Future: agent switching |
| **MCP protocol** | `crates/mcp-*/` | Tool discovery |
| **Web UI patterns** | `ui/` | UI component ideas |

### Session Pattern

```rust
// FROM: crates/goose/session.rs (concept)
struct Session {
    id: String,
    messages: Vec<Message>,
    tools: Vec<Tool>,
    context: Context,
}

impl Session {
    fn save(&self, path: &Path) { /* serialize to disk */ }
    fn load(path: &Path) -> Self { /* deserialize from disk */ }
}
```

**Port to our system:**
```javascript
// New: services/SessionService.js
class SessionService {
    constructor(dataDir = '.opencode/sessions') {
        this.dataDir = dataDir;
    }
    
    save(session) {
        const path = `${this.dataDir}/${session.id}.json`;
        fs.writeFileSync(path, JSON.stringify({
            id: session.id,
            created: session.created,
            messages: session.messages,
            files: session.files,
            projectPath: session.projectPath
        }, null, 2));
    }
    
    load(sessionId) {
        const path = `${this.dataDir}/${sessionId}.json`;
        return JSON.parse(fs.readFileSync(path, 'utf8'));
    }
    
    list() {
        return fs.readdirSync(this.dataDir)
            .filter(f => f.endsWith('.json'))
            .map(f => this.load(f.replace('.json', '')));
    }
}
```

---

## 6. OpenCode TUI (SST)
**Repo:** https://github.com/sst/opencode

### What They Have
```
packages/
├── core/           # Core agent logic
├── tui/            # Terminal UI (Ink-based)
├── lsp/            # Language Server Protocol
└── providers/      # LLM providers
```

### What We Take

| Feature | Their Location | Our Implementation |
|---------|----------------|-------------------|
| **LSP integration** | `packages/lsp/` | Code intelligence |
| **Beautiful TUI** | `packages/tui/` | Reference for Ink components |
| **Provider abstraction** | `packages/providers/` | Multi-LLM support |
| **Status indicators** | `packages/tui/components/` | Progress UI |

---

## 7. Mini-Agent (MiniMax)
**Repo:** https://github.com/MiniMax-AI/Mini-Agent

### What They Have
```
mini_agent/
├── agent.py        # Lightweight agent
├── tools.py        # Tool definitions
└── memory.py       # Context/memory management
```

### What We Take

| Feature | Their File | Our Implementation |
|---------|------------|-------------------|
| **Memory management** | `memory.py` | Context window optimization |
| **Simple agent loop** | `agent.py` | Reference for clarity |

### Memory Pattern

```python
# FROM: mini_agent/memory.py
class Memory:
    def __init__(self, max_tokens=8000):
        self.messages = []
        self.max_tokens = max_tokens
    
    def add(self, message):
        self.messages.append(message)
        self._prune_if_needed()
    
    def _prune_if_needed(self):
        """Remove old messages to stay under token limit"""
        while self._count_tokens() > self.max_tokens:
            # Keep system message, remove oldest user/assistant
            if len(self.messages) > 2:
                self.messages.pop(1)
```

---

## Summary: Code Extraction Checklist

### Immediate Priority

- [ ] **UIAutomation from Windows-Use** → `computer-use.cjs`
- [ ] **DOM extraction from browser-use** → `playwright-bridge.js`
- [ ] **Verify loop from Open-Interface** → `lib/iq-exchange.mjs`
- [ ] **Monaco Editor from VS Code** → New editor panel

### Medium Priority

- [ ] **Tools registry from browser-use** → `lib/tools-registry.js`
- [ ] **Session management from Goose** → `services/SessionService.js`
- [ ] **Grounding system from Windows-Use** → `services/GroundingService.js`

### Nice to Have

- [ ] **LSP from OpenCode** → Code intelligence
- [ ] **Memory optimization from Mini-Agent** → Context management
- [ ] **MCP protocol from Goose** → Tool discovery

---

*This document maps exactly what code to extract from each project.*
