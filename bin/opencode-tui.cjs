// OpenQode TUI - Clean interface with numbered selection
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Suppress console output from qwen-oauth
const _log = console.log;
console.log = () => { };
console.error = () => { };

// Lazy load qwen
let qwen = null;
function getQwen() {
    if (!qwen) {
        const { QwenOAuth } = require('../qwen-oauth.cjs');
        qwen = new QwenOAuth();
    }
    return qwen;
}

const print = (...args) => _log.apply(console, args);

// ANSI
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    white: '\x1b[97m'
};

// State
let agent = 'build';
let selectingAgent = false;
let agentList = [];
const agentDir = path.join(__dirname, '..', '.opencode', 'agent');
let conversationHistory = [];
const HISTORY_LIMIT = 15; // Keep last 15 turns to maintain context without overflowing
let useSmartContext = true; // State for Context Toggle
let exposedThinking = false; // Show all thinking lines when true
let useCodeCards = true; // Smart Code Presentation Layer
let codeCards = []; // Store parsed code blocks as cards

// Code Card Class for Smart Code Presentation
class CodeCard {
    constructor(id, language, filename, content) {
        this.id = id;
        this.language = language || 'text';
        this.filename = filename || `snippet_${id}`;
        this.content = content;
        this.lines = content.split('\n').length;
        this.expanded = false;
    }

    renderCollapsed() {
        const maxWidth = 55;
        const header = `📄 ${this.filename}`;
        const meta = `${this.lines} lines │ ${this.language}`;
        return `
${c.dim}┌─ ${c.cyan}${header}${c.dim} ${'─'.repeat(Math.max(0, maxWidth - header.length - 4))}┐${c.reset}
${c.dim}│ ${meta.padEnd(maxWidth - 2)} │${c.reset}
${c.dim}│ ${c.yellow}[${this.id}]${c.dim} Expand  ${c.yellow}[${this.id}c]${c.dim} Copy  ${c.yellow}[${this.id}w]${c.dim} Write${''.padEnd(maxWidth - 32)} │${c.reset}
${c.dim}└${'─'.repeat(maxWidth)}┘${c.reset}`;
    }

    renderExpanded() {
        const maxWidth = 60;
        const header = `📄 ${this.filename}`;
        const preview = this.content.split('\n').slice(0, 15).map(l =>
            `${c.dim}│${c.reset} ${l.substring(0, maxWidth - 4).padEnd(maxWidth - 4)} ${c.dim}│${c.reset}`
        ).join('\n');
        const more = this.lines > 15 ? `\n${c.dim}│ ... ${this.lines - 15} more lines ...${' '.repeat(maxWidth - 22 - String(this.lines - 15).length)}│${c.reset}` : '';

        return `
${c.dim}╔═ ${c.cyan}${c.bold}${header}${c.reset}${c.dim} ${'═'.repeat(Math.max(0, maxWidth - header.length - 4))}╗${c.reset}
${c.dim}║ ${c.green}${this.language}${c.dim} │ ${this.lines} lines${' '.repeat(maxWidth - this.language.length - String(this.lines).length - 12)}║${c.reset}
${c.dim}╠${'═'.repeat(maxWidth)}╣${c.reset}
${preview}${more}
${c.dim}╠${'═'.repeat(maxWidth)}╣${c.reset}
${c.dim}║ ${c.yellow}[${this.id}]${c.dim} Collapse  ${c.yellow}[${this.id}c]${c.dim} Copy  ${c.yellow}[${this.id}w]${c.dim} Write File${' '.repeat(maxWidth - 38)}║${c.reset}
${c.dim}╚${'═'.repeat(maxWidth)}╝${c.reset}`;
    }

    render() {
        return this.expanded ? this.renderExpanded() : this.renderCollapsed();
    }
}

// Dynamic session log path based on current project
function getSessionLogFile() {
    return path.join(currentProject || process.cwd(), '.opencode', 'session_log.md');
}

// Log interaction to file for context persistence
function logInteraction(user, assistant) {
    try {
        const logFile = getSessionLogFile();
        const dir = path.dirname(logFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const time = new Date().toISOString().split('T')[1].split('.')[0];
        const entry = `\n### [${time}] User:\n${user}\n\n### Assistant:\n${assistant}\n`;
        fs.appendFileSync(logFile, entry);
    } catch (e) { }
}

// Project Manager
const RECENT_PROJECTS_FILE = path.join(__dirname, '..', '.opencode', 'recent_projects.json');
let currentProject = process.cwd();

function loadRecentProjects() {
    try {
        if (fs.existsSync(RECENT_PROJECTS_FILE)) {
            return JSON.parse(fs.readFileSync(RECENT_PROJECTS_FILE, 'utf8'));
        }
    } catch (e) { }
    return [];
}

function saveRecentProject(projectPath) {
    try {
        let recent = loadRecentProjects();
        // Remove if exists, add to front
        recent = recent.filter(p => p !== projectPath);
        recent.unshift(projectPath);
        // Keep max 5
        recent = recent.slice(0, 5);
        const dir = path.dirname(RECENT_PROJECTS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(RECENT_PROJECTS_FILE, JSON.stringify(recent, null, 2));
    } catch (e) { }
}

function setWorkspace(projectPath) {
    try {
        process.chdir(projectPath);
        currentProject = projectPath;
        saveRecentProject(projectPath);
        return true;
    } catch (e) {
        return false;
    }
}

// Smart Code Presentation - Parse response and render code blocks as cards
function renderWithCodeCards(text) {
    if (!useCodeCards) return text;

    codeCards = []; // Reset cards
    let cardId = 1;

    // Parse code blocks and create cards
    const codeBlockRegex = /```(\w+)?(?:[:\s]+)?([^\n`]+\.\w+)?\n([\s\S]*?)```/g;

    const rendered = text.replace(codeBlockRegex, (match, lang, filename, content) => {
        const card = new CodeCard(cardId++, lang || 'code', filename || `snippet_${cardId}`, content.trim());
        codeCards.push(card);
        return card.render();
    });

    return rendered;
}

// Agentic File Operations - Extract code blocks and write files
function extractCodeBlocks(text) {
    const blocks = [];
    // Match ```filename.ext or ```language:filename.ext or ```language filename.ext
    const regex = /```(?:(\w+)[:\s]+)?([^\n`]+\.\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const language = match[1] || '';
        let filename = match[2] || '';
        const content = match[3] || '';

        // Try to extract filename from first line comment if not in header
        if (!filename && content) {
            const firstLine = content.split('\n')[0];
            const fileMatch = firstLine.match(/(?:\/\/|#|\/\*)\s*(?:file:|filename:)?\s*([^\s*\/]+\.\w+)/i);
            if (fileMatch) {
                filename = fileMatch[1];
            }
        }

        if (filename && content.trim()) {
            blocks.push({ filename: filename.trim(), content: content.trim(), language });
        }
    }
    return blocks;
}

async function processFileOperations(response, rl) {
    const blocks = extractCodeBlocks(response);
    if (blocks.length === 0) return;

    print(`\n${c.yellow}📁 Detected ${blocks.length} file(s) to create:${c.reset}`);
    blocks.forEach((b, i) => print(`  ${c.cyan}${i + 1}.${c.reset} ${b.filename}`));

    return new Promise((resolve) => {
        rl.question(`\n${c.cyan}Write files to project?${c.reset} [Y/n/select]: `, async (answer) => {
            const choice = answer.trim().toLowerCase();

            if (choice === 'n' || choice === 'no') {
                print(`${c.dim}  Skipped file creation.${c.reset}\n`);
                resolve();
                return;
            }

            // Write all or selected
            const toWrite = (choice === '' || choice === 'y' || choice === 'yes')
                ? blocks
                : blocks.filter((_, i) => choice.includes(String(i + 1)));

            for (const block of toWrite) {
                try {
                    // Handle absolute vs relative paths
                    let filePath;
                    if (path.isAbsolute(block.filename)) {
                        // Absolute path - use directly but warn user
                        filePath = block.filename;
                    } else {
                        // Relative path - join with project directory
                        filePath = path.join(currentProject, block.filename);
                    }

                    const dir = path.dirname(filePath);

                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    fs.writeFileSync(filePath, block.content);
                    print(`  ${c.green}✓${c.reset} Created: ${c.bold}${block.filename}${c.reset}`);
                } catch (err) {
                    print(`  ${c.yellow}⚠${c.reset} Failed: ${block.filename} - ${err.message}`);
                }
            }
            print('');
            resolve();
        });
    });
}

// Agentic Command Execution - Run shell commands with user confirmation
const { spawn, exec } = require('child_process');
let backgroundProcesses = [];

function extractCommands(text) {
    const commands = [];
    // Match ```bash:run or ```shell:run or ```cmd:run or just ```bash with a command
    const regex = /```(?:bash|shell|cmd|sh|powershell|ps1)(?::run)?[\s\n]+([\s\S]*?)```/gi;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const content = match[1].trim();
        if (content) {
            // Split multiple commands
            content.split('\n').forEach(line => {
                const cmd = line.trim();
                if (cmd && !cmd.startsWith('#')) {
                    commands.push(cmd);
                }
            });
        }
    }
    return commands;
}

async function processCommands(response, rl) {
    const commands = extractCommands(response);
    if (commands.length === 0) return;

    print(`\n${c.magenta}🖥️  Commands detected:${c.reset}`);
    commands.forEach((cmd, i) => print(`  ${c.cyan}${i + 1}.${c.reset} ${c.dim}${cmd}${c.reset}`));

    return new Promise((resolve) => {
        rl.question(`\n${c.cyan}Execute?${c.reset} [Y/n/select/bg]: `, async (answer) => {
            const choice = answer.trim().toLowerCase();

            if (choice === 'n' || choice === 'no') {
                print(`${c.dim}  Skipped command execution.${c.reset}\n`);
                resolve();
                return;
            }

            const runInBackground = choice === 'bg' || choice === 'background';
            const toRun = (choice === '' || choice === 'y' || choice === 'yes' || runInBackground)
                ? commands
                : commands.filter((_, i) => choice.includes(String(i + 1)));

            for (const cmd of toRun) {
                try {
                    print(`\n  ${c.cyan}▶${c.reset} Running: ${c.bold}${cmd}${c.reset}`);
                    print(`${c.dim}  ───────────────────────────────────────${c.reset}`);

                    if (runInBackground) {
                        // Background execution
                        const proc = spawn(cmd, [], {
                            shell: true,
                            cwd: currentProject,
                            detached: true,
                            stdio: ['ignore', 'pipe', 'pipe']
                        });

                        backgroundProcesses.push({ cmd, proc, pid: proc.pid });
                        print(`  ${c.green}✓${c.reset} Started in background (PID: ${proc.pid})`);
                        print(`  ${c.dim}Use /ps to see running processes${c.reset}`);
                    } else {
                        // Foreground execution with live output
                        await new Promise((cmdResolve) => {
                            const proc = spawn(cmd, [], {
                                shell: true,
                                cwd: currentProject,
                                stdio: ['inherit', 'pipe', 'pipe']
                            });

                            proc.stdout.on('data', (data) => {
                                const lines = data.toString().split('\n');
                                lines.forEach(line => {
                                    if (line.trim()) print(`  ${c.dim}${line}${c.reset}`);
                                });
                            });

                            proc.stderr.on('data', (data) => {
                                const lines = data.toString().split('\n');
                                lines.forEach(line => {
                                    if (line.trim()) print(`  ${c.yellow}${line}${c.reset}`);
                                });
                            });

                            proc.on('close', (code) => {
                                if (code === 0) {
                                    print(`  ${c.green}✓${c.reset} Completed (exit: ${code})`);
                                } else {
                                    print(`  ${c.yellow}⚠${c.reset} Exited with code: ${code}`);
                                }
                                cmdResolve();
                            });

                            proc.on('error', (err) => {
                                print(`  ${c.yellow}⚠${c.reset} Error: ${err.message}`);
                                cmdResolve();
                            });
                        });
                    }
                } catch (err) {
                    print(`  ${c.yellow}⚠${c.reset} Failed: ${err.message}`);
                }
            }
            print(`${c.dim}  ───────────────────────────────────────${c.reset}\n`);
            resolve();
        });
    });
}

function getAgents() {
    const list = ['build', 'plan'];
    try {
        if (fs.existsSync(agentDir)) {
            fs.readdirSync(agentDir)
                .filter(f => f.endsWith('.md'))
                .forEach(f => list.push(path.basename(f, '.md')));
        }
    } catch (e) { }
    return [...new Set(list)];
}

function loadAgentPrompt(agentName) {
    // 1. Try to load specific agent file
    try {
        const p = path.join(agentDir, `${agentName}.md`);
        if (fs.existsSync(p)) {
            return fs.readFileSync(p, 'utf8');
        }
    } catch (e) { }

    // Context awareness instruction (shared by all agents)
    const contextInstruction = `
IMPORTANT: You have access to the PROJECT CONTEXT and SESSION LOG below. Use this information!
- If there's a SESSION LOG, you know what we discussed before. Reference it naturally.
- If the user says "continue" or "resume", pick up exactly where the session log left off.
- Never ask "what project" or "where is it located" if context files are provided.

═══════════════════════════════════════════════════════════════
CLAUDE CODE COMMUNICATION STYLE - Follow this workflow EXACTLY:
═══════════════════════════════════════════════════════════════

1. START with a STATUS UPDATE:
   📋 **Current Task:** [what you're working on]
   📂 **Project:** [project name from context]
   
2. Before EACH major step, ANNOUNCE what you're doing:
   → Creating project structure...
   → Setting up database schema...
   → Installing dependencies...

3. After EACH step, CONFIRM completion with checkmarks:
   ✓ Created src/App.tsx
   ✓ Created src/components/Header.tsx
   ✓ Updated task.md

4. CONSULT the user before major decisions:
   ⚠️ **Decision needed:** Should we use MongoDB or PostgreSQL?
   📊 My recommendation: PostgreSQL (better for relational data)
   👉 Reply 'y' to proceed or tell me your preference.

5. UPDATE task.md with progress:
   - [x] Completed items get checked
   - [/] In-progress items
   - [ ] Pending items

6. SUMMARIZE after completing a phase:
   ───────────────────────────
   ✅ **Phase Complete: Project Setup**
   Created: 5 files
   Next: Database schema
   ───────────────────────────

7. PROPOSE tech stack with rationale table:
   | Component | Choice | Why |
   |-----------|--------|-----|
   | Frontend | React + Vite | Fast HMR, modern |
   | Backend | Express | Simple, flexible |
   | Database | PostgreSQL | Reliable, scales |
   
   👉 Proceed with this? (y/n)

NEVER ask vague questions. ALWAYS propose specific solutions.
ALWAYS update task.md as you work. Mark items [x] when done.
   Shall I proceed with this setup?"

FILE CREATION: When writing code, use this format so files can be auto-created:
\`\`\`javascript:src/index.js
// your code here
\`\`\`
The format is: \`\`\`language:path/to/filename.ext
Always include the full relative path. The user will be prompted to confirm file creation.

COMMAND EXECUTION: When you need to run commands (npm, docker, git, etc.), use:
\`\`\`bash
npm install
npm run dev
\`\`\`
Commands will be shown to the user for confirmation before executing. You can run multiple commands.
For long-running commands (servers), the user can choose to run in background.
`;

    // 2. Fallback defaults
    if (agentName === 'plan') {
        return `You are the PLAN agent. Your job is to analyze requests and create detailed architectural plans.
- Break down projects into clear phases and tasks.
- ALWAYS propose a complete technology stack with your recommendations.
- Create detailed task lists and file structures.
- DO NOT ask what technologies to use - PROPOSE them with brief justifications.
- After presenting the plan, ask "Shall I proceed?" or "Want me to adjust anything?"

DOCUMENT YOUR DECISIONS in task.md like this:
## Decisions & Rationale
- **React** - Modern, component-based, huge ecosystem
- **PostgreSQL** - ACID compliance, scales well, free
- **JWT Auth** - Stateless, works with APIs

${contextInstruction}`;
    }
    return `You are the BUILD agent. Your job is to build projects from start to finish.
- You are a senior full-stack developer helping a beginner.
- ALWAYS propose complete solutions with specific technologies.
- DO NOT ask questions about tech stack - RECOMMEND and explain your choices briefly.
- Start building immediately after user confirms your proposed plan.
- Create files, install dependencies, and set up the project structure proactively.

EXPLAIN YOUR CHOICES: For EVERY major decision, briefly explain WHY:
- "Using React because it's component-based and has great tooling"
- "Chose PostgreSQL for reliability and JSON support"
- "Using JWT tokens for stateless authentication"

UPDATE task.md with a "Decisions" section documenting your rationale:
## Decisions & Rationale
| Choice | Reason |
|--------|--------|
| React + Vite | Fast dev server, modern tooling |
| Material-UI | Professional look, less CSS work |
| PostgreSQL | Reliable, scales well, free |
${contextInstruction}`;
}

function getProjectContext() {
    let context = "";

    // 1. Load Session History (The "Context Manager" / "Shared Brain")
    const logFile = getSessionLogFile();
    if (fs.existsSync(logFile)) {
        try {
            const logContent = fs.readFileSync(logFile, 'utf8');
            // Keep last 20KB to avoid overflowing context
            const MAX_LOG_SIZE = 20000;
            if (logContent.length > MAX_LOG_SIZE) {
                context += `\n[PAST SESSION LOG (Truncated)]\n...${logContent.slice(-MAX_LOG_SIZE)}\n`;
            } else {
                context += `\n[FULL SESSION LOG]\n${logContent}\n`;
            }
        } catch (e) { }
    }

    // 2. Check for common context files in current directory
    const files = ['task.md', 'implementation_plan.md', 'TODO.md', 'README.md'];
    files.forEach(f => {
        if (fs.existsSync(f)) {
            const content = fs.readFileSync(f, 'utf8');
            // Limit context size per file
            if (content.length < 5000) {
                context += `\n--- FILE: ${f} ---\n${content}\n`;
            } else {
                context += `\n--- FILE: ${f} (Truncated) ---\n${content.substring(0, 5000)}\n...`;
            }
        }
    });
    return context;
}

function showHeader() {
    print('\x1b[2J\x1b[H');
    print(`${c.dim}───────────────────────────────────────────────────────${c.reset}`);
    print(`  ${c.bold}${c.cyan}◆ OpenQode v1.2 Alpha${c.reset}  ${c.dim}AI Coding Assistant${c.reset}`);
    print(`${c.dim}───────────────────────────────────────────────────────${c.reset}`);
    print(`  Agent: ${c.bold}${c.cyan}${agent}${c.reset}  ${c.dim}│${c.reset}  ${c.dim}/help for commands${c.reset}`);
    print(`  ${c.dim}Project:${c.reset} ${c.bold}${path.basename(currentProject)}${c.reset}`);
    print(`${c.dim}───────────────────────────────────────────────────────${c.reset}\n`);

    // Show short history summary
    if (conversationHistory.length > 0) {
        print(`${c.dim}  History: ${conversationHistory.length} messages loaded${c.reset}`);
    }

    // Show Smart Context Status
    const ctxStatus = useSmartContext ? `${c.green}[ON]${c.reset}` : `${c.dim}[OFF]${c.reset}`;
    let ctxSize = "0B";
    const logFile = getSessionLogFile();
    if (useSmartContext && fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        ctxSize = (stats.size / 1024).toFixed(1) + "KB";
    }
    print(`  ${c.bold}Smart Context:${c.reset} ${ctxStatus} ${c.dim}(${ctxSize})${c.reset}\n`);
}

// Show context summary after project load
function showContextSummary() {
    const logFile = getSessionLogFile();
    if (fs.existsSync(logFile)) {
        try {
            const content = fs.readFileSync(logFile, 'utf8');
            if (content.length > 100) {
                // Extract last few lines to show what was discussed
                const lines = content.split('\n').filter(l => l.trim());
                const lastLines = lines.slice(-10).join('\n').substring(0, 500);

                print(`${c.dim}───────────────────────────────────────────────────────${c.reset}`);
                print(`  ${c.bold}${c.green}📚 Session Restored!${c.reset}`);
                print(`  ${c.dim}I remember our previous conversation.${c.reset}`);
                print(`  ${c.dim}Just say "continue" or tell me what's next.${c.reset}`);
                print(`${c.dim}───────────────────────────────────────────────────────${c.reset}\n`);
            } else {
                print(`  ${c.dim}New session. What would you like to work on?${c.reset}\n`);
            }
        } catch (e) { }
    } else {
        // Check for task.md to understand project
        if (fs.existsSync('task.md') || fs.existsSync('README.md')) {
            print(`  ${c.dim}Project files detected. Tell me what you'd like to do!${c.reset}\n`);
        } else {
            print(`  ${c.dim}New project. What would you like to build?${c.reset}\n`);
        }
    }
}

function showAgentMenu() {
    agentList = getAgents();
    selectingAgent = true;
    print(`\n${c.bold}  Select Agent${c.reset} ${c.dim}(enter number or 0 to cancel)${c.reset}\n`);
    agentList.forEach((a, i) => {
        const current = a === agent ? `${c.green}●${c.reset}` : `${c.dim}○${c.reset}`;
        print(`  ${current} ${c.cyan}${i + 1}${c.reset}  ${a === agent ? c.white + c.bold : c.dim}${a}${c.reset}`);
    });
    print('');
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Startup: Project Selection Menu
function showProjectMenu() {
    print('\x1b[2J\x1b[H');
    print(`${c.dim}───────────────────────────────────────────────────────${c.reset}`);
    print(`  ${c.bold}${c.cyan}◆ OpenQode v1.2 Alpha${c.reset}  ${c.dim}AI Coding Assistant${c.reset}`);
    print(`${c.dim}───────────────────────────────────────────────────────${c.reset}\n`);

    print(`  ${c.bold}Choose your workspace:${c.reset}\n`);

    const recent = loadRecentProjects();
    const cwd = process.cwd();
    let options = [];

    // Option 1: Current directory
    print(`  ${c.cyan}1${c.reset}  ${c.dim}Current directory${c.reset}`);
    print(`     ${c.dim}${cwd}${c.reset}`);
    options.push({ type: 'cwd', path: cwd });

    // Recent projects (up to 3)
    let optNum = 2;
    recent.slice(0, 3).forEach(p => {
        if (p !== cwd && fs.existsSync(p)) {
            print(`  ${c.cyan}${optNum}${c.reset}  ${c.dim}Recent:${c.reset} ${path.basename(p)}`);
            print(`     ${c.dim}${p}${c.reset}`);
            options.push({ type: 'recent', path: p });
            optNum++;
        }
    });

    // Browse option
    print(`  ${c.cyan}${optNum}${c.reset}  ${c.yellow}Browse / Enter a path...${c.reset}`);
    options.push({ type: 'browse' });
    optNum++;

    // Create new
    print(`  ${c.cyan}${optNum}${c.reset}  ${c.green}Create new project${c.reset}`);
    options.push({ type: 'new' });

    print('');

    rl.question(`  ${c.cyan}Enter choice:${c.reset} `, (choice) => {
        const num = parseInt(choice);
        if (num >= 1 && num <= options.length) {
            const opt = options[num - 1];
            if (opt.type === 'cwd' || opt.type === 'recent') {
                if (setWorkspace(opt.path)) {
                    print(`\n${c.green}✓${c.reset} Workspace: ${c.bold}${opt.path}${c.reset}\n`);
                    showHeader();
                    showContextSummary(); // Show what we remember
                    prompt();
                } else {
                    print(`\n${c.yellow}⚠${c.reset} Could not access: ${opt.path}\n`);
                    showProjectMenu();
                }
            } else if (opt.type === 'browse') {
                rl.question(`  ${c.cyan}Enter full path:${c.reset} `, (customPath) => {
                    if (customPath.trim() && fs.existsSync(customPath.trim())) {
                        setWorkspace(customPath.trim());
                        print(`\n${c.green}✓${c.reset} Workspace: ${c.bold}${customPath.trim()}${c.reset}\n`);
                        showHeader();
                        prompt();
                    } else {
                        print(`\n${c.yellow}⚠${c.reset} Path not found.\n`);
                        showProjectMenu();
                    }
                });
            } else if (opt.type === 'new') {
                rl.question(`  ${c.cyan}New project path:${c.reset} `, (newPath) => {
                    if (newPath.trim()) {
                        try {
                            fs.mkdirSync(newPath.trim(), { recursive: true });
                            fs.writeFileSync(path.join(newPath.trim(), 'task.md'), '# Project Task List\n\n- [ ] Define project goals\n');
                            setWorkspace(newPath.trim());
                            print(`\n${c.green}✓${c.reset} Created: ${c.bold}${newPath.trim()}${c.reset}\n`);
                            showHeader();
                            prompt();
                        } catch (e) {
                            print(`\n${c.yellow}⚠${c.reset} Could not create: ${e.message}\n`);
                            showProjectMenu();
                        }
                    } else {
                        showProjectMenu();
                    }
                });
            }
        } else {
            showProjectMenu();
        }
    });
}

// Start with project menu
// Start with auth check then project menu
(async () => {
    const qwen = getQwen();
    const authed = await qwen.checkAuth();
    if (!authed) {
        print(`\n${c.yellow}Authentication required. Launching web login...${c.reset}\n`);

        const authScript = path.join(__dirname, 'auth.js');

        await new Promise((resolve) => {
            const child = spawn('node', [authScript], {
                stdio: 'inherit',
                shell: false
            });

            child.on('close', (code) => {
                if (code === 0) {
                    print(`\n${c.green}Authentication successful! Starting TUI...${c.reset}\n`);
                    resolve();
                } else {
                    print(`\n${c.red}Authentication failed or was cancelled.${c.reset}\n`);
                    process.exit(1);
                }
            });
        });

        // Re-check auth
        const recheck = await qwen.checkAuth();
        if (!recheck) {
            process.exit(1);
        }
    }
    showProjectMenu();
})();

function prompt() {
    const promptStr = selectingAgent ? `${c.cyan}#${c.reset} ` : `${c.green}❯${c.reset} `;

    rl.question(promptStr, async (input) => {
        const text = input.trim();

        // Agent selection mode
        if (selectingAgent) {
            const num = parseInt(text);
            if (num === 0 || text === '' || text.toLowerCase() === 'q') {
                selectingAgent = false;
                print(`${c.dim}  Cancelled${c.reset}\n`);
            } else if (num >= 1 && num <= agentList.length) {
                agent = agentList[num - 1];
                selectingAgent = false;
                print(`\n${c.green}✓${c.reset} Selected: ${c.bold}${c.cyan}${agent}${c.reset}\n`);
                showHeader();
            } else {
                print(`${c.dim}  Invalid. Enter 1-${agentList.length} or 0 to cancel${c.reset}\n`);
            }
            prompt();
            return;
        }

        if (!text) { prompt(); return; }

        if (text.startsWith('/')) {
            handleCommand(text);
            return;
        }

        // Construct Stateful Prompt
        const systemPrompt = loadAgentPrompt(agent);
        let projectContext = "";
        if (useSmartContext) {
            projectContext = getProjectContext();
        }

        let historyStr = "";
        if (useSmartContext) {
            conversationHistory.forEach(msg => {
                historyStr += `\n${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
            });
        }

        const fullPrompt = `[SYSTEM INSTRUCTIONS]
${systemPrompt}

[PROJECT CONTEXT]
${projectContext}

[CONVERSATION HISTORY]
${historyStr}

[CURRENT REQUEST]
User: ${text}
Assistant:`;

        // Live Thinking Indicator
        let elapsed = 0;
        const thinkingInterval = setInterval(() => {
            elapsed++;
            process.stdout.write(`\r${c.dim}  ● thinking... (${elapsed}s)${c.reset}`);
        }, 1000);
        print(`${c.dim}  ● thinking... (0s)${c.reset}`);

        // Smart Retry Logic
        const MAX_RETRIES = 2;
        let attempt = 0;
        let success = false;
        let lastError = null;

        while (attempt <= MAX_RETRIES && !success) {
            attempt++;
            try {
                // Streaming: display output as it arrives
                let streamStarted = false;
                let fullResponse = '';
                let thinkingLines = [];
                let lastThinkingCount = 0;
                let inThinkingBlock = false;

                // Patterns that indicate "thinking" output
                const thinkingPatterns = [
                    /^(Let me|Now let me|I'll|I need to|I notice|I should|Wait,|Now I)/i,
                    /^(Checking|Looking|Analyzing|Creating|Updating|Setting up)/i
                ];

                const isThinkingLine = (line) => {
                    return thinkingPatterns.some(pattern => pattern.test(line.trim()));
                };

                const result = await getQwen().sendMessage(fullPrompt, 'qwen-coder-plus', null, (chunk) => {
                    // First chunk - clear thinking indicator and show start
                    if (!streamStarted) {
                        clearInterval(thinkingInterval);
                        process.stdout.write('\r\x1b[2K'); // Clear the thinking line
                        print(`\n${c.cyan}◆${c.reset} `);
                        streamStarted = true;
                    }

                    // Clean ANSI codes
                    const cleanChunk = chunk.replace(/[\u001b\u009b][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
                    fullResponse += cleanChunk;

                    // Check each line for thinking patterns
                    const lines = cleanChunk.split('\n');
                    for (const line of lines) {
                        if (isThinkingLine(line)) {
                            thinkingLines.push(line.trim());

                            if (exposedThinking) {
                                // Exposed mode: show all thinking lines
                                process.stdout.write(`${c.dim}${line.trim()}${c.reset}\n`);
                            } else {
                                // Rolling window: show last 4 lines
                                const windowSize = 4;
                                const recentLines = thinkingLines.slice(-windowSize);
                                const clearLines = '\x1b[2K\x1b[1A'.repeat(Math.min(thinkingLines.length - 1, windowSize));
                                if (thinkingLines.length > 1) process.stdout.write(clearLines);
                                process.stdout.write(`${c.dim}💭 Thinking (${thinkingLines.length} steps):\n`);
                                recentLines.forEach(l => {
                                    process.stdout.write(`   ${l.substring(0, 70)}${l.length > 70 ? '...' : ''}\n`);
                                });
                                process.stdout.write(c.reset);
                            }
                            inThinkingBlock = true;
                        } else if (line.trim()) {
                            // Non-thinking content: show it
                            if (inThinkingBlock) {
                                process.stdout.write('\r\x1b[2K'); // Clear the thinking line
                                inThinkingBlock = false;
                            }
                            process.stdout.write(line);
                            if (!cleanChunk.endsWith(line)) process.stdout.write('\n');
                        } else {
                            // Empty lines
                            if (!inThinkingBlock) process.stdout.write('\n');
                        }
                    }
                });

                // Store thinking for /expand command
                if (thinkingLines.length > 0) {
                    global.lastThinking = thinkingLines;
                    if (inThinkingBlock) {
                        process.stdout.write(`\r\x1b[2K${c.dim}💭 ${thinkingLines.length} thinking steps (type /expand to see)${c.reset}\n`);
                    }
                }

                if (!streamStarted) {
                    clearInterval(thinkingInterval);
                    process.stdout.write('\r\x1b[2K'); // Clear the thinking line
                }

                if (result.success) {
                    // If streaming didn't happen (fallback), show full response
                    if (!streamStarted && result.response) {
                        // Render with code cards if enabled
                        const displayResponse = renderWithCodeCards(result.response);
                        print(`\n${c.cyan}◆${c.reset} ${displayResponse}\n`);
                    } else {
                        // For streamed content, re-render with cards at the end
                        if (useCodeCards && fullResponse) {
                            const cardDisplay = renderWithCodeCards(fullResponse);
                            // Only show card summary if cards were found
                            if (codeCards.length > 0) {
                                print(`\n${c.dim}📦 ${codeCards.length} code card(s) - use /card <n> to expand, /card <n>c to copy${c.reset}`);
                            }
                        }
                        print('\n'); // Add newline after streamed content
                    }

                    // Update History
                    conversationHistory.push({ role: 'user', content: text });
                    conversationHistory.push({ role: 'assistant', content: result.response });

                    // Persist to context file
                    if (useSmartContext) {
                        logInteraction(text, result.response);
                    }

                    // Trim history
                    if (conversationHistory.length > HISTORY_LIMIT * 2) {
                        conversationHistory = conversationHistory.slice(-(HISTORY_LIMIT * 2));
                    }

                    // Agentic: Process any file creation requests
                    await processFileOperations(result.response, rl);

                    // Agentic: Process any command execution requests
                    await processCommands(result.response, rl);

                    success = true;
                } else {
                    lastError = result.error;
                    if (attempt <= MAX_RETRIES) {
                        process.stdout.write(`\r${c.yellow}⚠ Attempt ${attempt} failed. Retrying...${c.reset}`);
                        await new Promise(r => setTimeout(r, 1000 * attempt)); // Backoff
                    }
                }
            } catch (err) {
                clearInterval(thinkingInterval);
                lastError = err.message;
                if (attempt <= MAX_RETRIES && (err.message.includes('timeout') || err.message.includes('ETIMEDOUT'))) {
                    process.stdout.write(`\r${c.yellow}⚠ Timeout. Retrying (${attempt}/${MAX_RETRIES})...${c.reset}\n`);
                    await new Promise(r => setTimeout(r, 2000 * attempt)); // Longer backoff for timeout
                } else {
                    break;
                }
            }
        }

        if (!success) {
            process.stdout.write('\r\x1b[2K');
            print(`\n${c.yellow}⚠${c.reset} ${lastError || 'Request failed.'}`);
            print(`${c.dim}  Tip: Try a shorter prompt or check your connection.${c.reset}\n`);
        }

        prompt();
    });
}

function handleCommand(text) {
    const parts = text.split(' ');
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
        case '/exit':
        case '/quit':
        case '/q':
            print(`\n${c.dim}Goodbye!${c.reset}\n`);
            process.exit(0);
            break;

        case '/clear':
        case '/c':
            showHeader();
            break;

        case '/new':
            print(`\n${c.green}✓${c.reset} ${c.dim}New conversation${c.reset}\n`);
            codeCards = []; // Reset code cards
            break;

        case '/cards':
            useCodeCards = !useCodeCards;
            print(`\n${c.green}✓${c.reset} Code Cards: ${useCodeCards ? c.bold + 'ON' : c.dim + 'OFF'}${c.reset}\n`);
            break;

        case '/card':
            if (parts.length < 2) {
                // List all cards
                if (codeCards.length === 0) {
                    print(`\n${c.dim}No code cards available. Send a message to get code first.${c.reset}\n`);
                } else {
                    print(`\n${c.bold}📦 Code Cards:${c.reset}`);
                    codeCards.forEach(card => print(card.render()));
                    print('');
                }
            } else {
                // Parse card ID and action
                const arg = parts[1];
                const cardId = parseInt(arg);
                const action = arg.replace(/\d+/, ''); // Extract action (c, w, e)

                const card = codeCards.find(c => c.id === (action ? parseInt(arg) : cardId));
                if (!card) {
                    print(`\n${c.dim}Card ${cardId || arg} not found.${c.reset}\n`);
                } else if (action === 'c' || parts[2] === 'copy') {
                    // Copy to clipboard
                    try {
                        require('child_process').execSync(
                            process.platform === 'win32'
                                ? `echo ${card.content.replace(/"/g, '\\"')} | clip`
                                : `echo "${card.content}" | pbcopy || xclip -selection clipboard`,
                            { stdio: 'pipe' }
                        );
                        print(`\n${c.green}✓${c.reset} Copied card ${card.id} to clipboard\n`);
                    } catch (e) {
                        print(`\n${c.yellow}⚠${c.reset} Clipboard copy failed. Content:\n${c.dim}${card.content.substring(0, 200)}...${c.reset}\n`);
                    }
                } else if (action === 'w' || parts[2] === 'write') {
                    // Write to file
                    try {
                        const filePath = path.isAbsolute(card.filename)
                            ? card.filename
                            : path.join(currentProject, card.filename);
                        const dir = path.dirname(filePath);
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        fs.writeFileSync(filePath, card.content);
                        print(`\n${c.green}✓${c.reset} Created: ${c.bold}${card.filename}${c.reset}\n`);
                    } catch (e) {
                        print(`\n${c.yellow}⚠${c.reset} Failed to write: ${e.message}\n`);
                    }
                } else {
                    // Toggle expand/collapse
                    card.expanded = !card.expanded;
                    print(card.render());
                }
            }
            break;

        case '/expand':
        case '/thinking':
            if (parts[1] === 'on') {
                exposedThinking = true;
                print(`\n${c.green}✓${c.reset} Exposed Thinking: ${c.bold}ON${c.reset} - See all AI reasoning\n`);
            } else if (parts[1] === 'off') {
                exposedThinking = false;
                print(`\n${c.green}✓${c.reset} Exposed Thinking: ${c.dim}OFF${c.reset} - Rolling 4-line window\n`);
            } else if (global.lastThinking && global.lastThinking.length > 0) {
                print(`\n${c.bold}💭 Last Thinking Process (${global.lastThinking.length} steps):${c.reset}`);
                print(`${c.dim}───────────────────────────────────────${c.reset}`);
                global.lastThinking.forEach((step, i) => {
                    print(`${c.dim}${i + 1}. ${step}${c.reset}`);
                });
                print(`${c.dim}───────────────────────────────────────${c.reset}`);
                print(`\n${c.dim}Tip: /thinking on|off to toggle exposed mode${c.reset}\n`);
            } else {
                print(`\n${c.dim}Exposed Thinking: ${exposedThinking ? 'ON' : 'OFF'}`);
                print(`Usage: /thinking on|off${c.reset}\n`);
            }
            break;

        case '/context':
        case '/brain':
            useSmartContext = !useSmartContext;
            showHeader();
            print(`\n${c.green}✓${c.reset} Smart Context is now ${useSmartContext ? c.bold + "ON" : c.dim + "OFF"}${c.reset}\n`);
            break;

        case '/project':
        case '/workspace':
            showProjectMenu();
            return; // Don't call prompt() here, showProjectMenu handles it

        case '/agents':
        case '/a':
            showAgentMenu();
            break;

        case '/ps':
        case '/processes':
            if (backgroundProcesses.length === 0) {
                print(`\n${c.dim}  No background processes running.${c.reset}\n`);
            } else {
                print(`\n${c.bold}  Background Processes:${c.reset}`);
                backgroundProcesses.forEach((p, i) => {
                    const alive = !p.proc.killed;
                    print(`  ${c.cyan}${i + 1}.${c.reset} [${alive ? c.green + 'RUNNING' : c.dim + 'STOPPED'}${c.reset}] PID:${p.pid} - ${c.dim}${p.cmd}${c.reset}`);
                });
                print('');
            }
            break;

        case '/kill':
            if (parts[1]) {
                const idx = parseInt(parts[1]) - 1;
                if (backgroundProcesses[idx]) {
                    try {
                        process.kill(backgroundProcesses[idx].pid);
                        print(`\n${c.green}✓${c.reset} Killed process ${backgroundProcesses[idx].pid}\n`);
                    } catch (e) {
                        print(`\n${c.yellow}⚠${c.reset} ${e.message}\n`);
                    }
                } else {
                    print(`\n${c.yellow}⚠${c.reset} Invalid process number. Use /ps to list.\n`);
                }
            } else {
                print(`\n${c.dim}  Usage: /kill <number> - Use /ps to see process list.${c.reset}\n`);
            }
            break;

        case '/run':
            const cmdToRun = parts.slice(1).join(' ');
            if (cmdToRun) {
                print(`\n  ${c.cyan}▶${c.reset} Running: ${c.bold}${cmdToRun}${c.reset}`);
                exec(cmdToRun, { cwd: currentProject }, (err, stdout, stderr) => {
                    if (stdout) print(`${c.dim}${stdout}${c.reset}`);
                    if (stderr) print(`${c.yellow}${stderr}${c.reset}`);
                    if (err) print(`${c.yellow}⚠ Error: ${err.message}${c.reset}`);
                    prompt();
                });
                return;
            } else {
                print(`\n${c.dim}  Usage: /run <command>${c.reset}\n`);
            }
            break;

        // Update help menu separately
        case '/clear':
        case '/c':
            showHeader();
            break;

        case '/add':
            print(`\n${c.bold}  Create New Agent${c.reset}\n`);
            rl.question(`  ${c.cyan}Name${c.reset} (lowercase, no spaces): `, (name) => {
                if (!name.trim()) {
                    print(`${c.dim}  Cancelled${c.reset}\n`);
                    prompt();
                    return;
                }
                const safeName = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                rl.question(`  ${c.cyan}Purpose${c.reset} (what should it do?): `, (purpose) => {
                    if (!purpose.trim()) {
                        print(`${c.dim}  Cancelled${c.reset}\n`);
                        prompt();
                        return;
                    }
                    // Create agent file
                    const agentPath = path.join(agentDir, `${safeName}.md`);
                    const content = `# ${safeName.charAt(0).toUpperCase() + safeName.slice(1)} Agent\n\n${purpose.trim()}\n`;
                    try {
                        if (!fs.existsSync(agentDir)) {
                            fs.mkdirSync(agentDir, { recursive: true });
                        }
                        fs.writeFileSync(agentPath, content);
                        print(`\n${c.green}✓${c.reset} Created: ${c.cyan}${safeName}${c.reset}`);
                        print(`${c.dim}  File: .opencode/agent/${safeName}.md${c.reset}\n`);
                        agent = safeName;
                        showHeader();
                    } catch (err) {
                        print(`\n${c.yellow}⚠${c.reset} Failed: ${err.message}\n`);
                    }
                    prompt();
                });
            });
            return;

        case '/help':
        case '/?':
            print(`
${c.bold}  Commands${c.reset}
  ${c.cyan}/project${c.reset}  ${c.dim}Switch workspace / project${c.reset}
  ${c.cyan}/context${c.reset}  ${c.dim}Toggle Smart Context (Brain)${c.reset}
  ${c.cyan}/thinking${c.reset} ${c.dim}Toggle exposed thinking mode (on|off)${c.reset}
  ${c.cyan}/expand${c.reset}   ${c.dim}View last thinking process${c.reset}
  ${c.cyan}/cards${c.reset}    ${c.dim}Toggle code card presentation${c.reset}
  ${c.cyan}/card${c.reset}     ${c.dim}List code cards or /card <n> to expand${c.reset}
  ${c.cyan}/agents${c.reset}   ${c.dim}Browse and select agents${c.reset}
  ${c.cyan}/add${c.reset}      ${c.dim}Create a new agent${c.reset}
  ${c.cyan}/run${c.reset}      ${c.dim}Execute a shell command${c.reset}
  ${c.cyan}/ps${c.reset}       ${c.dim}List background processes${c.reset}
  ${c.cyan}/kill${c.reset}     ${c.dim}Stop a background process${c.reset}
  ${c.cyan}/new${c.reset}      ${c.dim}Start fresh conversation${c.reset}
  ${c.cyan}/clear${c.reset}    ${c.dim}Clear screen${c.reset}
  ${c.cyan}/exit${c.reset}     ${c.dim}Quit${c.reset}
`);
            break;

        default:
            print(`\n${c.dim}  Unknown command. Try /help${c.reset}\n`);
    }
    prompt();
}

prompt();
