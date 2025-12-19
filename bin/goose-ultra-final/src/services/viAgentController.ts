// Vi Agent Controller - AI-Powered Computer Use Agent
// Implements the Agent Loop pattern from: browser-use, Windows-Use, Open-Interface
// 
// Architecture:
// 1. Take screenshot
// 2. Send screenshot + task to AI (vision model)
// 3. AI returns next action as JSON
// 4. Execute action
// 5. Repeat until done

import { ViControlAction, actionToPowerShell, POWERSHELL_SCRIPTS } from './viControlEngine';

export interface AgentState {
    status: 'idle' | 'thinking' | 'executing' | 'done' | 'error';
    currentTask: string;
    stepCount: number;
    maxSteps: number;
    lastScreenshot?: string;
    lastAction?: ViControlAction;
    history: AgentStep[];
    error?: string;
}

export interface AgentStep {
    stepNumber: number;
    thought: string;
    action: ViControlAction | null;
    result: string;
    screenshot?: string;
    timestamp: number;
}

export interface AgentConfig {
    maxSteps: number;
    screenshotDelay: number;
    actionDelay: number;
    visionModel: 'qwen-vl' | 'gpt-4-vision' | 'gemini-vision';
}

const DEFAULT_CONFIG: AgentConfig = {
    maxSteps: 15,
    screenshotDelay: 1000,
    actionDelay: 500,
    visionModel: 'qwen-vl'
};

// System prompt for the vision AI agent
const AGENT_SYSTEM_PROMPT = `You are Vi Control, an AI agent that controls a Windows computer to accomplish tasks.

You will receive:
1. A TASK the user wants to accomplish
2. A SCREENSHOT of the current screen state
3. HISTORY of previous actions taken

Your job is to analyze the screenshot and decide the NEXT SINGLE ACTION to take.

RESPOND WITH JSON ONLY:
{
    "thought": "Brief analysis of what you see and what needs to be done next",
    "action": {
        "type": "click" | "type" | "press_key" | "scroll" | "wait" | "done",
        "x": <number for click x coordinate>,
        "y": <number for click y coordinate>,
        "text": "<text to type>",
        "key": "<key to press: enter, tab, esc, etc>",
        "direction": "<up or down for scroll>",
        "reason": "<why you're taking this action>"
    },
    "done": <true if task is complete, false otherwise>,
    "confidence": <0-100 how confident you are>
}

IMPORTANT RULES:
1. Look at the SCREENSHOT carefully - identify UI elements, text, buttons
2. Give PRECISE click coordinates for buttons/links (estimate center of element)
3. If you need to search, first click the search box, then type
4. After typing in a search box, press Enter to search
5. Wait after page loads before next action
6. Set "done": true when the task is complete
7. If stuck, try a different approach

COMMON ACTIONS:
- Click on a button: {"type": "click", "x": 500, "y": 300}
- Type text: {"type": "type", "text": "search query"}
- Press Enter: {"type": "press_key", "key": "enter"}
- Scroll down: {"type": "scroll", "direction": "down"}
- Wait for page: {"type": "wait"}
- Task complete: {"done": true}`;

// Main agent controller class
export class ViAgentController {
    private state: AgentState;
    private config: AgentConfig;
    private onStateChange?: (state: AgentState) => void;
    private onStepComplete?: (step: AgentStep) => void;
    private abortController?: AbortController;

    constructor(config: Partial<AgentConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.state = {
            status: 'idle',
            currentTask: '',
            stepCount: 0,
            maxSteps: this.config.maxSteps,
            history: []
        };
    }

    // Subscribe to state changes
    subscribe(callbacks: {
        onStateChange?: (state: AgentState) => void;
        onStepComplete?: (step: AgentStep) => void;
    }) {
        this.onStateChange = callbacks.onStateChange;
        this.onStepComplete = callbacks.onStepComplete;
    }

    // Update state and notify listeners
    private updateState(updates: Partial<AgentState>) {
        this.state = { ...this.state, ...updates };
        this.onStateChange?.(this.state);
    }

    // Take screenshot using PowerShell
    async takeScreenshot(): Promise<string> {
        const electron = (window as any).electron;
        if (!electron?.runPowerShell) {
            throw new Error('PowerShell bridge not available');
        }

        return new Promise((resolve, reject) => {
            const sessionId = `screenshot-${Date.now()}`;
            let output = '';

            electron.removeExecListeners?.();
            electron.onExecChunk?.(({ text }: any) => {
                output += text;
            });
            electron.onExecComplete?.(() => {
                // Extract the screenshot path from output
                const match = output.match(/\$env:TEMP\\\\(.+\.png)/);
                const path = match ? `${process.env.TEMP}\\${match[1]}` : output.trim();
                resolve(path);
            });
            electron.onExecError?.((err: any) => reject(err));

            electron.runPowerShell(sessionId, POWERSHELL_SCRIPTS.screenshot(), true);
            setTimeout(() => resolve(output.trim()), 5000);
        });
    }

    // Convert screenshot to base64 for AI
    async screenshotToBase64(path: string): Promise<string> {
        const electron = (window as any).electron;
        return new Promise((resolve) => {
            const script = `
                $bytes = [System.IO.File]::ReadAllBytes("${path}")
                [Convert]::ToBase64String($bytes)
            `;
            const sessionId = `base64-${Date.now()}`;
            let output = '';

            electron.removeExecListeners?.();
            electron.onExecChunk?.(({ text }: any) => {
                output += text;
            });
            electron.onExecComplete?.(() => {
                resolve(output.trim());
            });

            electron.runPowerShell(sessionId, script, true);
            setTimeout(() => resolve(output.trim()), 10000);
        });
    }

    // Send to AI vision model and get next action
    async getNextAction(task: string, screenshotBase64: string, history: AgentStep[]): Promise<{
        thought: string;
        action: ViControlAction | null;
        done: boolean;
        confidence: number;
    }> {
        const electron = (window as any).electron;

        // Build history context
        const historyContext = history.slice(-5).map(step =>
            `Step ${step.stepNumber}: ${step.thought} -> ${step.action?.type || 'none'} -> ${step.result}`
        ).join('\n');

        const userMessage = `TASK: ${task}

PREVIOUS ACTIONS:
${historyContext || 'None yet - this is the first step'}

CURRENT SCREENSHOT: [Image attached]

What is the next single action to take?`;

        return new Promise((resolve) => {
            let response = '';

            electron.removeChatListeners?.();
            electron.onChatChunk?.(({ content }: any) => {
                response += content;
            });
            electron.onChatComplete?.(() => {
                try {
                    // Try to extract JSON from response
                    const jsonMatch = response.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);

                        let action: ViControlAction | null = null;
                        if (parsed.action && !parsed.done) {
                            switch (parsed.action.type) {
                                case 'click':
                                    action = {
                                        type: 'mouse_click',
                                        params: { x: parsed.action.x, y: parsed.action.y, button: 'left' },
                                        description: parsed.action.reason || `Click at (${parsed.action.x}, ${parsed.action.y})`
                                    };
                                    break;
                                case 'type':
                                    action = {
                                        type: 'keyboard_type',
                                        params: { text: parsed.action.text },
                                        description: `Type: ${parsed.action.text}`
                                    };
                                    break;
                                case 'press_key':
                                    action = {
                                        type: 'keyboard_press',
                                        params: { key: parsed.action.key },
                                        description: `Press: ${parsed.action.key}`
                                    };
                                    break;
                                case 'scroll':
                                    action = {
                                        type: 'scroll',
                                        params: { direction: parsed.action.direction, amount: 3 },
                                        description: `Scroll ${parsed.action.direction}`
                                    };
                                    break;
                                case 'wait':
                                    action = {
                                        type: 'wait',
                                        params: { ms: 2000 },
                                        description: 'Wait for page to load'
                                    };
                                    break;
                            }
                        }

                        resolve({
                            thought: parsed.thought || 'Analyzing...',
                            action,
                            done: parsed.done || false,
                            confidence: parsed.confidence || 50
                        });
                    } else {
                        resolve({
                            thought: 'Could not parse AI response',
                            action: null,
                            done: true,
                            confidence: 0
                        });
                    }
                } catch (e) {
                    resolve({
                        thought: `Parse error: ${e}`,
                        action: null,
                        done: true,
                        confidence: 0
                    });
                }
            });

            // Use Qwen VL or other vision model
            // For now, we'll use qwen-coder-plus with a text description
            // In production, this would use qwen-vl with the actual image
            electron.startChat([
                { role: 'system', content: AGENT_SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: userMessage,
                    // In a full implementation, we'd include:
                    // images: [{ data: screenshotBase64, type: 'base64' }]
                }
            ], 'qwen-coder-plus');

            // Timeout
            setTimeout(() => {
                resolve({
                    thought: 'AI timeout',
                    action: null,
                    done: true,
                    confidence: 0
                });
            }, 30000);
        });
    }

    // Execute a single action
    async executeAction(action: ViControlAction): Promise<string> {
        const electron = (window as any).electron;
        const script = actionToPowerShell(action);

        return new Promise((resolve) => {
            const sessionId = `action-${Date.now()}`;
            let output = '';

            electron.removeExecListeners?.();
            electron.onExecChunk?.(({ text }: any) => {
                output += text + '\n';
            });
            electron.onExecComplete?.(() => {
                resolve(output || 'Action completed');
            });

            electron.runPowerShell(sessionId, script, true);
            setTimeout(() => resolve(output || 'Timeout'), 15000);
        });
    }

    // Main agent loop
    async run(task: string): Promise<AgentState> {
        this.abortController = new AbortController();

        this.updateState({
            status: 'thinking',
            currentTask: task,
            stepCount: 0,
            history: [],
            error: undefined
        });

        try {
            while (this.state.stepCount < this.config.maxSteps) {
                if (this.abortController.signal.aborted) {
                    throw new Error('Agent aborted');
                }

                this.updateState({ status: 'thinking' });

                // Step 1: Take screenshot
                const screenshotPath = await this.takeScreenshot();
                this.updateState({ lastScreenshot: screenshotPath });

                // Wait for screenshot to be ready
                await new Promise(r => setTimeout(r, this.config.screenshotDelay));

                // Step 2: Get base64 of screenshot
                const screenshotBase64 = await this.screenshotToBase64(screenshotPath);

                // Step 3: Ask AI for next action
                const { thought, action, done, confidence } = await this.getNextAction(
                    task,
                    screenshotBase64,
                    this.state.history
                );

                // Create step record
                const step: AgentStep = {
                    stepNumber: this.state.stepCount + 1,
                    thought,
                    action,
                    result: '',
                    screenshot: screenshotPath,
                    timestamp: Date.now()
                };

                // Check if done
                if (done) {
                    step.result = 'Task completed';
                    this.state.history.push(step);
                    this.onStepComplete?.(step);
                    this.updateState({
                        status: 'done',
                        stepCount: this.state.stepCount + 1,
                        history: [...this.state.history]
                    });
                    break;
                }

                // Step 4: Execute action
                if (action) {
                    this.updateState({ status: 'executing', lastAction: action });
                    const result = await this.executeAction(action);
                    step.result = result;

                    // Wait after action
                    await new Promise(r => setTimeout(r, this.config.actionDelay));
                } else {
                    step.result = 'No action returned';
                }

                // Record step
                this.state.history.push(step);
                this.onStepComplete?.(step);
                this.updateState({
                    stepCount: this.state.stepCount + 1,
                    history: [...this.state.history]
                });
            }

            if (this.state.status !== 'done') {
                this.updateState({
                    status: 'error',
                    error: `Max steps (${this.config.maxSteps}) reached`
                });
            }
        } catch (error: any) {
            this.updateState({
                status: 'error',
                error: error.message || 'Unknown error'
            });
        }

        return this.state;
    }

    // Stop the agent
    stop() {
        this.abortController?.abort();
        this.updateState({ status: 'idle' });
    }

    // Get current state
    getState(): AgentState {
        return { ...this.state };
    }
}

// Helper to detect if task requires AI agent (complex reasoning)
export function requiresAgentLoop(input: string): boolean {
    const complexPatterns = [
        /then\s+(?:go\s+through|look\s+at|analyze|find|choose|select|pick|decide)/i,
        /and\s+(?:open|click|select)\s+(?:the\s+)?(?:one|best|most|first|any)/i,
        /(?:interesting|relevant|suitable|appropriate|good|best)/i,
        /(?:browse|explore|navigate)\s+(?:through|around)/i,
        /(?:read|analyze|understand)\s+(?:the|this|that)/i,
        /(?:compare|evaluate|assess)/i,
        /(?:find|search)\s+(?:for|and)\s+(?:then|and)/i,
    ];

    return complexPatterns.some(pattern => pattern.test(input));
}

// Simplified agent for basic tasks (no vision, just chain execution)
export async function runSimpleChain(
    actions: ViControlAction[],
    onProgress?: (step: number, action: ViControlAction, result: string) => void
): Promise<{ success: boolean; results: string[] }> {
    const electron = (window as any).electron;
    const results: string[] = [];

    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const script = actionToPowerShell(action);

        const result = await new Promise<string>((resolve) => {
            const sessionId = `simple-${Date.now()}-${i}`;
            let output = '';

            electron.removeExecListeners?.();
            electron.onExecChunk?.(({ text }: any) => {
                output += text + '\n';
            });
            electron.onExecComplete?.(() => {
                resolve(output || 'Done');
            });

            electron.runPowerShell(sessionId, script, true);
            setTimeout(() => resolve(output || 'Timeout'), 15000);
        });

        results.push(result);
        onProgress?.(i + 1, action, result);

        // Delay between actions
        await new Promise(r => setTimeout(r, 500));
    }

    return { success: true, results };
}

export default ViAgentController;
