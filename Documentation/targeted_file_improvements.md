# OpenQode Targeted File-by-File Improvement Recommendations

*Specific file modifications mapped to improvement areas*

## 📁 **Web Interface Improvements**

### **File**: `web/index.html`
**Current Issues**: Overcrowded layout, poor responsive design, cluttered panel structure

**Targeted Changes**:
1. **Add Modal Container Structure**
   ```html
   <!-- Replace static sidebar with collapsible modal -->
   <div id="command-palette" class="modal hidden">
     <div class="modal-backdrop" onclick="closeCommandPalette()"></div>
     <div class="modal-content">
       <input type="text" id="command-input" placeholder="Type a command...">
       <div id="command-results"></div>
     </div>
   </div>
   
   <!-- Add progressive disclosure wrapper -->
   <div id="contextual-sidebar" class="sidebar-modal">
     <!-- Dynamic content based on current task -->
   </div>
   ```

2. **Enhanced Message Structure**
   ```html
   <!-- Replace basic message divs with structured components -->
   <div class="message-wrapper" data-message-type="thinking">
     <div class="message-header">
       <span class="message-icon">💭</span>
       <span class="message-title">AI Thinking</span>
       <button class="thinking-toggle" onclick="toggleThinking()">Hide</button>
     </div>
     <div class="message-content thinking-steps">
       <!-- Step-by-step reasoning -->
     </div>
   </div>
   ```

### **File**: `web/app.js`
**Current Issues**: Monolithic functions, poor state management, no context awareness

**Targeted Changes**:
1. **Add Command Palette System**
   ```javascript
   // Add to OpenQodeWeb class
   openCommandPalette() {
     const palette = document.getElementById('command-palette');
     const input = document.getElementById('command-input');
     palette.classList.remove('hidden');
     input.focus();
     
     this.commandPalette = new CommandPalette([
       { id: 'new-project', title: 'New Project', action: () => this.startNewProjectFlow() },
       { id: 'save-file', title: 'Save File', action: () => this.saveCurrentFile() },
       { id: 'toggle-thinking', title: 'Toggle AI Thinking', action: () => this.toggleThinkingMode() }
     ]);
   }
   
   // Add keyboard shortcut
   document.addEventListener('keydown', (e) => {
     if (e.ctrlKey && e.key === 'p') {
       e.preventDefault();
       this.openCommandPalette();
     }
   });
   ```

2. **Enhanced Thinking Stream**
   ```javascript
   // Add to sendMessageStream method
   showThinkingProcess(thinkingSteps) {
     const thinkingContainer = document.createElement('div');
     thinkingContainer.className = 'thinking-stream';
     thinkingContainer.innerHTML = thinkingSteps.map((step, index) => `
       <div class="thinking-step">
         <span class="step-number">${index + 1}</span>
         <span class="step-content">${step}</span>
         ${step.confidence ? `<div class="confidence-bar" style="width: ${step.confidence}%"></div>` : ''}
       </div>
     `).join('');
     
     return thinkingContainer;
   }
   ```

3. **Context Awareness Panel**
   ```javascript
   // Add context tracking
   updateContextPanel(activeFiles, recentActions, aiReasoning) {
     const sidebar = document.getElementById('contextual-sidebar');
     sidebar.innerHTML = `
       <div class="context-section">
         <h4>Active Files</h4>
         ${activeFiles.map(file => `<div class="context-chip">${file}</div>`).join('')}
       </div>
       <div class="context-section">
         <h4>Recent Actions</h4>
         ${recentActions.map(action => `<div class="action-item">${action}</div>`).join('')}
       </div>
       <div class="context-section">
         <h4>AI Context</h4>
         <div class="context-scope">${aiReasoning.scope}</div>
       </div>
     `;
   }
   ```

### **File**: `web/styles.css`
**Current Issues**: Inconsistent spacing, poor visual hierarchy, no responsive design

**Targeted Changes**:
1. **Design System Implementation**
   ```css
   :root {
     /* Color System */
     --color-primary: #007ACC;
     --color-primary-hover: #005A9E;
     --color-success: #28A745;
     --color-warning: #FFC107;
     --color-error: #DC3545;
     --color-thinking: #6F42C1;
     
     /* Spacing System */
     --space-xs: 4px;
     --space-sm: 8px;
     --space-md: 16px;
     --space-lg: 24px;
     --space-xl: 32px;
     
     /* Typography Scale */
     --font-size-xs: 11px;
     --font-size-sm: 13px;
     --font-size-md: 15px;
     --font-size-lg: 17px;
     --font-size-xl: 21px;
     
     /* Surface Hierarchy */
     --surface-elevated: 0 2px 8px rgba(0,0,0,0.15);
     --surface-floating: 0 4px 16px rgba(0,0,0,0.2);
   }
   
   /* Message Type Styling */
   .message-wrapper[data-message-type="thinking"] {
     border-left: 4px solid var(--color-thinking);
     background: linear-gradient(90deg, rgba(111, 66, 193, 0.1) 0%, transparent 100%);
   }
   
   .message-wrapper[data-message-type="user"] {
     border-left: 4px solid var(--color-primary);
   }
   
   .message-wrapper[data-message-type="assistant"] {
     border-left: 4px solid var(--color-success);
   }
   
   /* Command Palette Styling */
   .modal {
     position: fixed;
     top: 0;
     left: 0;
     width: 100%;
     height: 100%;
     background: rgba(0,0,0,0.5);
     z-index: 1000;
     display: flex;
     align-items: flex-start;
     justify-content: center;
     padding-top: 10vh;
   }
   
   .modal-content {
     background: white;
     border-radius: 8px;
     box-shadow: var(--surface-floating);
     min-width: 600px;
     max-width: 80vw;
   }
   
   /* Responsive Design */
   @media (max-width: 768px) {
     .main-grid {
       grid-template-columns: 1fr;
       grid-template-rows: auto auto 1fr;
     }
     
     .left-panel, .right-panel {
       display: none;
     }
     
     .center-panel {
       grid-column: 1;
     }
   }
   ```

## 🖥️ **TUI Component Improvements**

### **File**: `bin/ui/components/ChatBubble.mjs`
**Current Issues**: Basic styling, no thinking process display, poor message differentiation

**Targeted Changes**:
```javascript
// Enhanced ChatBubble with thinking support
const ChatBubble = ({ role, content, meta, width, children, thinkingSteps }) => {
  const contentWidth = width ? width - 2 : undefined;
  
  // Thinking indicator for assistant messages
  if (role === 'assistant' && thinkingSteps?.length > 0) {
    return h(Box, { width: width, flexDirection: 'column' },
      // Thinking process display
      h(Box, { marginBottom: 1, flexDirection: 'row' },
        h(Text, { color: 'magenta', bold: true }, '💭 AI Thinking:'),
        h(Text, { color: 'gray', marginLeft: 1 }, `(${thinkingSteps.length} steps)`)
      ),
      thinkingSteps.slice(-3).map((step, i) =>
        h(Text, { 
          key: i, 
          color: 'gray', 
          dimColor: true,
          wrap: 'truncate',
          marginLeft: 2
        }, `  ${step.substring(0, width - 6)}`)
      ),
      
      // Main response
      h(Box, { 
        width: width, 
        flexDirection: 'row', 
        marginTop: 1
      },
        h(Box, { width: 2, marginRight: 1, borderStyle: 'single', borderRight: false, borderTop: false, borderBottom: false, borderLeftColor: 'green' }),
        h(Box, { flexDirection: 'column', flexGrow: 1, minWidth: 10 },
          children ? children : h(Text, { color: 'white', wrap: 'wrap' }, content)
        )
      )
    );
  }
  
  // Original implementation for non-thinking messages
  return h(Box, { 
    width: width, 
    flexDirection: 'row', 
    marginBottom: 1
  },
    h(Box, { width: 2, marginRight: 1, borderStyle: 'single', borderRight: false, borderTop: false, borderBottom: false, borderLeftColor: getRoleColor(role) }),
    h(Box, { flexDirection: 'column', flexGrow: 1, minWidth: 10 },
      children ? children : h(Text, { color: 'white', wrap: 'wrap' }, content)
    )
  );
};

function getRoleColor(role) {
  const colors = {
    user: 'cyan',
    assistant: 'green',
    system: 'yellow',
    error: 'red',
    thinking: 'magenta'
  };
  return colors[role] || 'gray';
}
```

### **File**: `bin/ui/components/AgentRail.mjs`
**Current Issues**: Basic rail design, no context awareness

**Targeted Changes**:
```javascript
// Enhanced AgentRail with context awareness
export const AssistantMessage = ({ content, isStreaming = false, children, context = {} }) => {
  const railChar = isStreaming ? '┃' : '│';
  const railColor = isStreaming ? 'yellow' : RAIL_COLORS.assistant;
  
  return h(Box, {
    flexDirection: 'row',
    marginTop: 1,
    marginBottom: 1
  },
    // Enhanced left rail with context indicators
    h(Box, {
      width: 2,
      flexShrink: 0,
      flexDirection: 'column'
    },
      h(Text, { color: railColor }, railChar),
      // Context indicators
      context.activeFiles?.length > 0 && h(Text, { color: 'blue', fontSize: 'xs' }, '📁'),
      context.recentActions?.length > 0 && h(Text, { color: 'green', fontSize: 'xs' }, '⚡')
    ),
    // Content area with context chips
    h(Box, {
      flexDirection: 'column',
      flexGrow: 1,
      paddingLeft: 1
    },
      // Context summary
      (context.activeFiles?.length > 0 || context.recentActions?.length > 0) && h(Box, {
        marginBottom: 0.5,
        flexDirection: 'row',
        flexWrap: 'wrap'
      },
        context.activeFiles?.slice(0, 2).map(file =>
          h(Text, { key: file, color: 'blue', dimColor: true, fontSize: 'xs', marginRight: 1 },
            `[${file}]`)
        )
      ),
      children || h(Text, { wrap: 'wrap' }, content)
    )
  );
};
```

### **File**: `bin/ui/components/ThinkingBlock.mjs`
**Current Issues**: Limited thinking display, no confidence indicators

**Targeted Changes**:
```javascript
// Enhanced ThinkingBlock with confidence and context
const ThinkingBlock = ({
  lines = [],
  isThinking = false,
  stats = { chars: 0 },
  width = 80,
  confidence = null,
  contextInfluences = []
}) => {
  if (lines.length === 0 && !isThinking) return null;

  const visibleLines = lines.slice(-3);
  const hiddenCount = Math.max(0, lines.length - 3);

  return h(Box, {
    flexDirection: 'row',
    width: width,
    marginBottom: 1,
    paddingLeft: 1
  },
    // Enhanced left gutter
    h(Box, { 
      width: 2,
      marginRight: 1, 
      borderStyle: 'single', 
      borderRight: false, 
      borderTop: false, 
      borderBottom: false, 
      borderLeftColor: isThinking ? 'yellow' : (confidence > 0.8 ? 'green' : confidence > 0.5 ? 'yellow' : 'red')
    }),
    
    h(Box, { flexDirection: 'column', flexGrow: 1 },
      // Enhanced header with confidence
      h(Box, { marginBottom: 0.5, flexDirection: 'row', alignItems: 'center' },
        h(Text, { color: isThinking ? 'yellow' : 'gray', dimColor: !isThinking },
          isThinking ? '💭 thinking...' : '💭 reasoning'
        ),
        confidence !== null && h(Text, { 
          color: confidence > 0.8 ? 'green' : confidence > 0.5 ? 'yellow' : 'red',
          marginLeft: 1,
          fontSize: 'xs'
        }, `(${Math.round(confidence * 100)}% confidence)`),
        stats.activeAgent && h(Text, { color: 'magenta', marginLeft: 1, fontSize: 'xs' }, `(${stats.activeAgent})`),
        h(Text, { color: 'gray', marginLeft: 1, fontSize: 'xs' }, `(${stats.chars} chars)`)
      ),
      
      // Thinking steps
      visibleLines.map((line, i) =>
        h(Text, { 
          key: i, 
          color: 'gray', 
          dimColor: true, 
          wrap: 'truncate',
          fontSize: 'xs'
        }, `  ${line.substring(0, width - 6)}`)
      ),
      
      // Context influences
      contextInfluences.length > 0 && h(Box, { marginTop: 0.5 },
        h(Text, { color: 'blue', dimColor: true, fontSize: 'xs' }, '  📚 Context:'),
        ...contextInfluences.slice(0, 2).map(influence =>
          h(Text, { key: influence, color: 'blue', dimColor: true, fontSize: 'xs', marginLeft: 2 },
            `    • ${influence}`)
        )
      ),
      
      // Hidden count indicator
      hiddenCount > 0 && h(Text, { 
        color: 'gray', 
        dimColor: true,
        marginLeft: 2,
        fontSize: 'xs'
      }, `+${hiddenCount} more steps`)
    )
  );
};
```

## 🧠 **Core Logic Improvements**

### **File**: `lib/iq-exchange.mjs`
**Current Issues**: Basic command extraction, no context awareness in thinking process

**Targeted Changes**:
```javascript
// Enhanced translation with context awareness
export class IQExchange {
  async translateRequest(userRequest, context = {}) {
    const prompt = `
══════════════════════════════════════════════════════════════════════════════════
ENHANCED COMMAND TRANSLATION WITH CONTEXT AWARENESS
══════════════════════════════════════════════════════════════════════════════════

USER REQUEST: "${userRequest}"

CURRENT CONTEXT:
- Active Files: ${context.activeFiles?.join(', ') || 'None'}
- Recent Actions: ${context.recentActions?.slice(-3).join(', ') || 'None'}
- Current Directory: ${context.currentDirectory || 'Unknown'}
- Project Type: ${context.projectType || 'Unknown'}

AVAILABLE TOOLS (WINDOWS AUTOMATION):
Use the following commands to automate the computer. 
All commands are run via PowerShell using 'bin/input.ps1'.

► VISION & CONTEXT (The Eyes)
  • app_state "App Name"       -> Structural Vision: Dumps the specific UI tree
  • ocr "region"               -> Textual Vision: READS all text on screen
  • screenshot "file.png"      -> Visual Vision: Captures the screen state

► NAVIGATION & STATE
  • open "App Name"            -> Launches or focuses an app
  • waitfor "Text" 10          -> Waits up to 10s for text/element to appear
  • focus "Element Name"       -> Focuses a specific element

► INTERACTION (Robust UIA Hooks)
  • uiclick "Button Name"      -> Clicks a button/text by name (Reliable)
  • uipress "Item Name"        -> Toggles checkboxes, Selects list items
  • type "Text to type"        -> Types text into the focused element
  • key "Enter"                -> Presses a key (Enter, Tab, Esc, Backspace)

CONTEXTUAL INSTRUCTIONS:
1. Consider the current active files and recent actions
2. Use app_state to understand current screen state when uncertain
3. Prefer uiclick over mouse coordinates for reliability
4. Include verification steps (waitfor) for async operations
5. Output commands in a single code block

Expected Output Format:
\`\`\`powershell
powershell bin/input.ps1 open "Notepad"
powershell bin/input.ps1 waitfor "Untitled" 5
powershell bin/input.ps1 uiclick "File"
\`\`\`
`.trim();

    const response = await this.sendToAI(prompt);
    
    // Enhanced response with confidence and context tracking
    return {
      commands: extractExecutables(response),
      confidence: this.calculateConfidence(response, context),
      contextUsed: this.identifyContextUsage(response, context),
      reasoning: this.extractReasoning(response)
    };
  }
  
  calculateConfidence(response, context) {
    // Simple confidence calculation based on context relevance
    let confidence = 0.7; // Base confidence
    
    if (context.activeFiles?.length > 0) confidence += 0.1;
    if (context.recentActions?.length > 0) confidence += 0.1;
    if (context.projectType) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }
  
  identifyContextUsage(response, context) {
    const influences = [];
    
    if (context.activeFiles?.some(file => response.includes(file))) {
      influences.push(`Referenced active file: ${context.activeFiles.find(file => response.includes(file))}`);
    }
    
    if (context.recentActions?.some(action => response.toLowerCase().includes(action.toLowerCase()))) {
      influences.push('Built upon recent actions');
    }
    
    return influences;
  }
  
  extractReasoning(response) {
    // Extract reasoning steps from AI response
    const reasoningMatch = response.match(/REASONING:(.*?)(?=\n\n|\n[A-Z]|\Z)/s);
    return reasoningMatch ? reasoningMatch[1].trim().split('\n').filter(line => line.trim()) : [];
  }
}
```

### **File**: `lib/computer-use.mjs`
**Current Issues**: Basic command execution, no context tracking

**Targeted Changes**:
```javascript
// Enhanced computer use with context tracking
export async function executeSequence(commands, options = {}) {
  const {
    onCommand = () => { },
    onResult = () => { },
    onContextUpdate = () => { },
    stopOnError = true,
    delayBetween = 500,
    context = {}
  } = options;

  const results = [];
  let currentContext = { ...context };

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    onCommand(i, command, currentContext);

    try {
      // Update context before execution
      currentContext = updateContextFromCommand(command, currentContext);
      onContextUpdate(currentContext);
      
      const result = await executeCommand(command);
      results.push({ command, ...result, context: { ...currentContext } });
      onResult(i, result, currentContext);

      if (!result.success && stopOnError) {
        break;
      }

      // Wait between commands
      if (i < commands.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetween));
      }
    } catch (error) {
      results.push({ command, success: false, error: error.message, context: { ...currentContext } });
      if (stopOnError) break;
    }
  }

  return { results, finalContext: currentContext };
}

function updateContextFromCommand(command, context) {
  const newContext = { ...context };
  
  // Track file operations
  if (command.includes('open') && command.includes('Notepad')) {
    newContext.currentApp = 'Notepad';
  }
  
  // Track navigation
  if (command.includes('navigate')) {
    const urlMatch = command.match(/navigate\s+"([^"]+)"/);
    if (urlMatch) {
      newContext.currentUrl = urlMatch[1];
    }
  }
  
  // Track recent actions
  newContext.recentActions = [
    command.substring(0, 50),
    ...(newContext.recentActions || []).slice(0, 4)
  ];
  
  return newContext;
}
```

## 🎨 **Theme System Improvements**

### **File**: `bin/themes.mjs`
**Current Issues**: Basic theme switching, no advanced customization

**Targeted Changes**:
```javascript
// Enhanced theme system with accessibility and customization
export const EnhancedThemes = {
  dracula: {
    name: 'Dracula',
    colors: {
      primary: '#bd93f9',
      secondary: '#6272a4',
      accent: '#ff79c6',
      background: '#282a36',
      surface: '#44475a',
      text: '#f8f8f2',
      textSecondary: '#6272a4',
      border: '#44475a',
      success: '#50fa7b',
      warning: '#f1fa8c',
      error: '#ff5555'
    },
    fonts: {
      mono: 'Fira Code, Consolas, monospace',
      sans: 'Inter, system-ui, sans-serif'
    }
  },
  
  accessibility: {
    name: 'High Contrast',
    colors: {
      primary: '#0066cc',
      secondary: '#004499',
      accent: '#ff6600',
      background: '#ffffff',
      surface: '#f5f5f5',
      text: '#000000',
      textSecondary: '#333333',
      border: '#666666',
      success: '#008800',
      warning: '#cc8800',
      error: '#cc0000'
    },
    fonts: {
      mono: 'Courier New, monospace',
      sans: 'Arial, sans-serif'
    },
    accessibility: {
      highContrast: true,
      largeFonts: true,
      focusIndicators: true
    }
  }
};

export class ThemeManager {
  constructor() {
    this.currentTheme = 'dracula';
    this.customThemes = new Map();
    this.accessibilitySettings = {
      highContrast: false,
      largeFonts: false,
      reducedMotion: false,
      focusIndicators: true
    };
  }
  
  applyTheme(themeName) {
    const theme = this.customThemes.get(themeName) || EnhancedThemes[themeName];
    if (!theme) return;
    
    // Apply CSS custom properties
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    
    // Apply accessibility settings
    if (theme.accessibility || this.accessibilitySettings.highContrast) {
      root.classList.add('accessibility-mode');
    }
    
    // Apply font settings
    Object.entries(theme.fonts).forEach(([key, value]) => {
      root.style.setProperty(`--font-${key}`, value);
    });
    
    this.currentTheme = themeName;
    this.saveThemePreference();
  }
  
  createCustomTheme(name, baseTheme, modifications) {
    const customTheme = {
      ...EnhancedThemes[baseTheme],
      ...modifications,
      name: name,
      custom: true
    };
    
    this.customThemes.set(name, customTheme);
    return customTheme;
  }
}
```

## 🔧 **Server Enhancements**

### **File**: `server.js`
**Current Issues**: Basic session management, no context persistence

**Targeted Changes**:
```javascript
// Enhanced session management with context persistence
const enhancedSessions = new Map();

app.post('/api/sessions/save', async (req, res) => {
  try {
    const sessionData = req.body;
    const sessionId = sessionData.id || 'default';
    
    // Enhance session data with context
    const enhancedSession = {
      ...sessionData,
      context: {
        activeFiles: sessionData.activeFiles || [],
        recentActions: sessionData.recentActions || [],
        projectType: sessionData.projectType || null,
        userPreferences: sessionData.userPreferences || {},
        aiReasoning: sessionData.aiReasoning || []
      },
      createdAt: sessionData.createdAt || new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      version: (sessionData.version || 0) + 1
    };
    
    enhancedSessions.set(sessionId, enhancedSession);
    await saveEnhancedSessions();
    
    res.json({ success: true, sessionId, version: enhancedSession.version });
  } catch (error) {
    console.error('Enhanced session save error:', error);
    res.status(500).json({ error: 'Failed to save enhanced session' });
  }
});

app.get('/api/sessions/load', async (req, res) => {
  try {
    const sessionId = req.query.id || 'default';
    const sessionData = enhancedSessions.get(sessionId) || { 
      sessions: {}, 
      currentSession: 'default',
      context: {}
    };
    
    // Add session analytics
    sessionData.analytics = calculateSessionAnalytics(sessionData);
    
    res.json(sessionData);
  } catch (error) {
    console.error('Enhanced session load error:', error);
    res.status(500).json({ error: 'Failed to load enhanced session' });
  }
});

// Context-aware chat endpoint
app.post('/api/chat/context-aware', async (req, res) => {
  try {
    const { message, sessionId, context } = req.body;
    
    // Load session context
    const session = enhancedSessions.get(sessionId);
    const enhancedContext = {
      ...session?.context,
      ...context,
      timestamp: new Date().toISOString()
    };
    
    // Enhance message with context
    const enhancedMessage = `
CONTEXT FROM SESSION:
Active Files: ${enhancedContext.activeFiles?.join(', ') || 'None'}
Recent Actions: ${enhancedContext.recentActions?.slice(-3).join(', ') || 'None'}
Project Type: ${enhancedContext.projectType || 'Unknown'}

USER MESSAGE: ${message}

Please consider the above context when responding.
    `;
    
    // Process with enhanced context
    const result = await qwenOAuth.sendMessage(enhancedMessage, 'qwen-coder-plus');
    
    // Update session context
    if (session) {
      session.context = {
        ...enhancedContext,
        recentActions: [
          `User: ${message.substring(0, 50)}...`,
          `AI: ${result.response?.substring(0, 50)}...`,
          ...(enhancedContext.recentActions || []).slice(0, 8)
        ],
        lastActivity: new Date().toISOString()
      };
    }
    
    res.json({
      success: true,
      response: result.response,
      context: enhancedContext,
      reasoning: result.reasoning || []
    });
  } catch (error) {
    console.error('Context-aware chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## 📱 **Launch Script Improvements**

### **File**: `OpenQode.bat` (Windows)
**Current Issues**: Basic script, no enhanced startup experience

**Targeted Changes**:
```batch
@echo off
title OpenQode - AI-Powered Coding Assistant

:: Enhanced startup with better UX
echo.
echo ===============================================
echo    OpenQode v1.01 - AI Coding Assistant
echo ===============================================
echo.

:: Check for required dependencies
echo [1/4] Checking dependencies...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js 16+ first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found

:: Check for npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm not found. Please install npm.
    pause
    exit /b 1
)

echo ✅ npm found

:: Install dependencies if needed
if not exist "node_modules" (
    echo [2/4] Installing dependencies...
    echo This may take a few minutes on first run...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed
) else (
    echo [2/4] Dependencies already installed
)

:: Enhanced menu with better UX
echo.
echo ===============================================
echo              OpenQode Launcher
echo ===============================================
echo.
echo Please choose an interface:
echo.
echo 🏠 TUI Interfaces (Recommended)
echo    5) Next-Gen TUI (Gen 5) - Full featured dashboard
echo    4) TUI Classic (Gen 4) - Lightweight interface
echo.
echo 🔧 CLI Tools
echo    2) Qwen TUI (CLI) - Official qwen CLI
echo    3) OpenCode TUI (Windows) - Native Windows binary
echo.
echo 🌐 Web Interfaces (Early Development)
echo    1) Web GUI - Browser-based interface
echo    7) Web Assist Dashboard
echo    8) Web IDE
echo.
echo 🛠️ Utilities
echo    6) Agent Manager
echo    9) Smart Repair Agent
echo    0) Exit
echo.

set /p choice="Enter your choice (0-9): "

:: Enhanced option handling
if "%choice%"=="5" goto nextgen_tui
if "%choice%"=="4" goto classic_tui
if "%choice%"=="2" goto qwen_cli
if "%choice%"=="3" goto opencode_cli
if "%choice%"=="1" goto web_gui
if "%choice%"=="7" goto web_assist
if "%choice%"=="8" goto web_ide
if "%choice%"=="6" goto agent_manager
if "%choice%"=="9" goto smart_repair
if "%choice%"=="0" goto exit
if "%choice%"=="" goto menu

echo Invalid choice. Please try again.
pause
goto menu

:nextgen_tui
echo.
echo 🚀 Starting Next-Gen TUI...
echo This will open a full-featured dashboard with:
echo   • Split panes and animated borders
echo   • RGB visuals and interactive menus  
echo   • Streaming responses and SmartX engine
echo   • Multi-agent support and auto-execution
echo.
pause
node bin/opencode-ink.mjs --enhanced
goto end

:classic_tui
echo.
echo 📟 Starting Classic TUI...
echo This opens a lightweight single-stream interface.
echo.
pause
node bin/opencode-ink.mjs --classic
goto end

:web_gui
echo.
echo 🌐 Starting Web GUI...
echo Opening browser to http://localhost:15044
echo.
start http://localhost:15044
node server.js 15044
goto end

:smart_repair
echo.
echo 🔧 Starting Smart Repair Agent...
echo This will diagnose and fix common issues automatically.
echo.
pause
node bin/smart-repair.mjs
goto end

:exit
echo.
echo 👋 Thanks for using OpenQode!
echo.
pause
exit /b 0

:end
```

## 📋 **Summary of File Changes**

| File | Primary Improvements | Priority |
|------|---------------------|----------|
| `web/index.html` | Modal structure, enhanced message layout, responsive design | High |
| `web/app.js` | Command palette, thinking streams, context awareness | High |
| `web/styles.css` | Design system, responsive layouts, accessibility | High |
| `bin/ui/components/ChatBubble.mjs` | Thinking process display, context integration | Medium |
| `bin/ui/components/AgentRail.mjs` | Enhanced context indicators, visual hierarchy | Medium |
| `bin/ui/components/ThinkingBlock.mjs` | Confidence indicators, context tracking | Medium |
| `lib/iq-exchange.mjs` | Context-aware translation, confidence calculation | High |
| `lib/computer-use.mjs` | Context tracking, enhanced execution | Medium |
| `bin/themes.mjs` | Accessibility themes, customization system | Low |
| `server.js` | Enhanced session management, context persistence | High |
| `OpenQode.bat` | Better UX, dependency checking, enhanced menu | Low |

## 🎯 **Implementation Priority**

1. **Phase 1 (High Priority)**: Web interface improvements (`web/index.html`, `web/app.js`, `web/styles.css`)
2. **Phase 2 (High Priority)**: Core logic enhancements (`lib/iq-exchange.mjs`, `server.js`)
3. **Phase 3 (Medium Priority)**: TUI component improvements (`bin/ui/components/*.mjs`)
4. **Phase 4 (Low Priority)**: Theme system and launch script improvements

This targeted approach ensures each improvement is mapped to specific, actionable file changes that can be implemented incrementally while maintaining system stability.