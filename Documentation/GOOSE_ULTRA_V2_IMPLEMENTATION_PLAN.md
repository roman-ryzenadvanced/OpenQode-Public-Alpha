# Goose Ultra V2 - Core Implementation Plan

**Mission**: Perfect the chat-to-code experience by building on the original Goose concept with world-class IDE integration and AI-native patterns.

---

## Phase 1: Core State Machine & Flow (Week 1)

### 1.1 State Machine Architecture
Implement the primary flow: `NoProject → IdeaCapture → Planning → Building → PreviewReady`

**Key States:**
- `NoProject`: Landing screen, awaiting user idea
- `IdeaCapture`: User describes their vision in natural language
- `Planning`: AI generates implementation blueprint with file structure
- `Building`: Code generation in progress with streaming feedback
- `PreviewReady`: Live preview + Monaco Editor available
- `Editing`: User actively modifying code in Monaco

**State Transitions:**
```typescript
type StateTransition = {
  from: OrchestratorState;
  to: OrchestratorState;
  trigger: 'user_input' | 'ai_complete' | 'build_complete' | 'user_edit';
  validator?: (context: Context) => boolean;
};
```

### 1.2 Orchestrator Pattern (from Goose)
**Source**: https://github.com/block/goose

**Learnings to integrate:**
1. **Agent Loop**: Goose uses a continuous agent loop with tool calling
2. **Session Management**: Persistent sessions with message history
3. **Tool Integration**: Structured tool calling pattern for file operations
4. **Error Recovery**: Graceful fallback when tools fail

**Implementation:**
```typescript
// orchestrator-v2.ts
export class GooseUltraOrchestrator {
  private state: OrchestratorState;
  private session: Session;
  private aiProvider: QwenProvider;
  
  async processUserIntent(input: string) {
    // 1. Validate current state allows this transition
    // 2. Send to AI with state context
    // 3. Stream response with state updates
    // 4. Transition to next state on completion
  }
  
  async executeStateTransition(transition: StateTransition) {
    // Atomic state updates with rollback capability
  }
}
```

---

## Phase 2: IDE Core - Monaco Integration (Week 1-2)

### 2.1 Monaco Editor Setup
**Source**: https://github.com/microsoft/vscode

**Core Features to Implement:**
1. **Syntax Highlighting**: Language-aware highlighting for HTML/CSS/JS
2. **IntelliSense**: Auto-completion based on file context
3. **Multi-File Support**: Tabbed interface for index.html, style.css, script.js
4. **Live Error Detection**: Real-time linting and validation
5. **Diff View**: Show AI-generated changes vs. current code

**Implementation:**
```typescript
// components/MonacoEditor.tsx
import * as monaco from 'monaco-editor';

export const CodeEditor = () => {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string>('index.html');
  
  useEffect(() => {
    const editor = monaco.editor.create(editorRef.current, {
      value: files[activeFile],
      language: getLanguage(activeFile),
      theme: 'goose-ultra-dark',
      minimap: { enabled: true },
      fontSize: 14,
      fontFamily: 'JetBrains Mono',
      lineNumbers: 'on',
      contextmenu: true,
      automaticLayout: true,
    });
    
    // Listen for changes and update state
    editor.onDidChangeModelContent(() => {
      setFiles({ ...files, [activeFile]: editor.getValue() });
    });
  }, [activeFile]);
  
  return (
    <div className="editor-container">
      <FileTabs files={Object.keys(files)} active={activeFile} onChange={setActiveFile} />
      <div ref={editorRef} className="monaco-editor" />
    </div>
  );
};
```

### 2.2 Custom Monaco Theme
```typescript
monaco.editor.defineTheme('goose-ultra-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'C586C0' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
  ],
  colors: {
    'editor.background': '#0A0A0B',
    'editor.foreground': '#D4D4D4',
    'editor.lineHighlightBackground': '#ffffff0a',
    'editorCursor.foreground': '#34D399',
  }
});
```

---

## Phase 3: Qwen OAuth Integration (Week 2)

### 3.1 OAuth Flow Implementation
**Critical Dependency** - De-risk this first

**Flow:**
1. User clicks "Authenticate with Qwen"
2. Open browser to Qwen OAuth page
3. User grants permission
4. Redirect to local server with auth code
5. Exchange code for access token + refresh token
6. Store tokens securely (encrypted)

**Implementation:**
```typescript
// services/qwen-oauth.ts
export class QwenOAuthService {
  private clientId = process.env.QWEN_CLIENT_ID;
  private redirectUri = 'http://localhost:8765/callback';
  
  async startOAuthFlow() {
    const state = generateRandomState();
    const authUrl = `https://dashscope.aliyuncs.com/oauth/authorize?` +
      `client_id=${this.clientId}&` +
      `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
      `response_type=code&` +
      `state=${state}`;
    
    // Open browser
    shell.openExternal(authUrl);
    
    // Start local server to receive callback
    const server = await this.createCallbackServer();
    
    return new Promise((resolve) => {
      server.on('auth_complete', (tokens) => {
        this.storeTokens(tokens);
        resolve(tokens);
      });
    });
  }
  
  async refreshAccessToken(refreshToken: string) {
    // Token refresh logic
  }
  
  private async storeTokens(tokens: TokenSet) {
    // Encrypt and store in OS keychain
    const encrypted = encryptTokens(tokens);
    await keytar.setPassword('goose-ultra', 'qwen-tokens', encrypted);
  }
}
```

### 3.2 Qwen API Client
```typescript
// services/qwen-client.ts
export class QwenClient {
  private accessToken: string;
  
  async chat(messages: Message[], options: ChatOptions) {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen-coder-plus',
        input: { messages },
        parameters: {
          stream: true,
          temperature: 0.7,
        }
      })
    });
    
    // Handle streaming response
    const reader = response.body.getReader();
    for await (const chunk of this.readStream(reader)) {
      options.onChunk?.(chunk);
    }
  }
}
```

---

## Phase 4: AI-Native Patterns (Week 2-3)

### 4.1 CodeNomad Learnings
**Source**: https://github.com/NeuralNomadsAI/CodeNomad.git

**Patterns to Adopt:**
1. **Context-Aware Prompting**: Include file structure, dependencies, and user preferences in AI context
2. **Streaming with Artifacts**: Display partial results as they generate
3. **Multi-Step Planning**: Break complex requests into atomic steps
4. **Code Validation**: Automatic syntax checking + security scanning before applying changes
5. **Rollback Mechanism**: Git-like history for AI-generated changes

### 4.2 Enhanced AI Prompt Engineering
```typescript
// services/prompt-builder.ts
export class PromptBuilder {
  buildCodeGenerationPrompt(context: CodeContext) {
    return `
<role>You are an expert full-stack developer</role>

<context>
  <project_type>${context.projectType}</project_type>
  <file_structure>
    ${context.files.map(f => `- ${f.name}`).join('\n    ')}
  </file_structure>
  <user_preferences>
    - UI Library: ${context.uiLibrary || 'Vanilla CSS'}
    - Style: ${context.styleGuide || 'Modern, minimal'}
  </user_preferences>
</context>

<task>
  ${context.userRequest}
</task>

<constraints>
  1. CRITICAL: Output ONLY executable code - no explanations
  2. Use single-file HTML with embedded CSS and JS
  3. Include actual UI elements (buttons, inputs, forms)
  4. No server-side templates or frameworks
  5. Start immediately with: <!DOCTYPE html>
</constraints>

<output_format>
<!DOCTYPE html>
<html>
  <!-- Your implementation here -->
</html>
</output_format>
    `;
  }
}
```

### 4.3 Code Validation Pipeline
```typescript
// services/code-validator.ts
export class CodeValidator {
  async validate(code: string): Promise<ValidationResult> {
    const results = await Promise.all([
      this.checkSyntax(code),
      this.checkSecurity(code),
      this.checkAccessibility(code),
      this.checkPerformance(code),
    ]);
    
    return {
      isValid: results.every(r => r.passed),
      errors: results.flatMap(r => r.errors),
      warnings: results.flatMap(r => r.warnings),
    };
  }
  
  private async checkSecurity(code: string) {
    // Scan for XSS, eval(), dangerouslySetInnerHTML, etc.
    const dangerousPatterns = [
      /eval\(/g,
      /innerHTML\s*=/g,
      /document\.write/g,
    ];
    
    const violations = [];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        violations.push({
          severity: 'high',
          message: `Detected potentially unsafe pattern: ${pattern}`,
        });
      }
    }
    
    return { passed: violations.length === 0, errors: violations };
  }
}
```

---

## Phase 5: Vibe Style Guide (Week 3)

### 5.1 AI Personality
**Tone**: Confident, efficient, slightly playful
**Voice**: Direct but encouraging
**Behavior**: Proactive suggestions, anticipates needs

**Examples:**
- ❌ "Here's the code you requested."
- ✅ "Built. Preview ready. I also added responsive breakpoints—mobile looks slick."

### 5.2 UI Motion
**Principles:**
1. **Purposeful**: Every animation conveys state or provides feedback
2. **Swift**: 200-300ms for most transitions
3. **Natural**: Easing curves mimic physical motion

**Key Animations:**
```css
/* State Transitions */
.state-enter {
  animation: slideAndFade 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideAndFade {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* AI Thinking Indicator */
.ai-thinking {
  animation: pulse 1.5s ease-in-out infinite;
}

/* Code Appearing */
.code-stream {
  animation: typewriter 0.5s steps(40, end);
}
```

### 5.3 Sound Design
**Audio Cues:**
- `start-build.mp3`: Satisfying "whoosh" when AI begins work
- `build-complete.mp3`: Subtle "ding" on completion
- `error.mp3`: Gentle "thud" for errors (not harsh)
- `keystroke.mp3`: Optional typing sounds for AI streaming

**Implementation:**
```typescript
// services/sound-manager.ts
export class SoundManager {
  private sounds = new Map<string, HTMLAudioElement>();
  
  constructor() {
    this.preload(['start-build', 'build-complete', 'error', 'keystroke']);
  }
  
  play(sound: SoundType, volume = 0.3) {
    const audio = this.sounds.get(sound);
    if (audio && !this.isMuted) {
      audio.volume = volume;
      audio.currentTime = 0;
      audio.play();
    }
  }
}
```

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Set up Next.js project structure
- [ ] Implement core state machine
- [ ] Integrate Monaco Editor basic setup
- [ ] Create Orchestrator V2 with state management

### Week 2: AI Integration
- [ ] Implement Qwen OAuth flow (PRIORITY)
- [ ] Build Qwen API client with streaming
- [ ] Create prompt builder with context injection
- [ ] Add code validation pipeline

### Week 3: Polish & Patterns
- [ ] Implement CodeNomad patterns
- [ ] Create vibe style guide document
- [ ] Add sound design
- [ ] Build diff viewer for AI changes

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                  User Interface                 │
├─────────────────────────────────────────────────┤
│  StartView  →  ChatPanel  →  MonacoEditor      │
│                     ↓                            │
│              PreviewPanel                        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│            Orchestrator V2 (State Machine)      │
├─────────────────────────────────────────────────┤
│  - State Management                             │
│  - Transition Validation                        │
│  - Tool Coordination                            │
└─────────────────────────────────────────────────┘
                      ↓
┌──────────────┬──────────────┬──────────────────┐
│ Qwen Client  │  Monaco API  │  File System     │
│ (OAuth)      │  (VSCode)    │  (Electron)      │
└──────────────┴──────────────┴──────────────────┘
```

---

## Success Metrics

1. **Time to First Code**: < 5 seconds from user idea to AI response
2. **Code Quality**: 95%+ of generated code passes validation
3. **User Flow**: Users can go from idea → working preview in under 60 seconds
4. **OAuth Reliability**: 100% success rate on token refresh
5. **Editor Performance**: Monaco remains responsive with files up to 10,000 lines

---

## Next Steps

1. Review and approve this plan
2. Set up new Next.js project structure
3. Begin Week 1 implementation
4. Daily check-ins on progress

Would you like me to start implementing Phase 1 now?
