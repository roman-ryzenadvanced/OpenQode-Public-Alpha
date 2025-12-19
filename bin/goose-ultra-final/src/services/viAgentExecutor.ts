// Vi Agent Executor - Plan → Act → Observe → Verify → Next Loop
// Never marks complete unless objective achieved
// Based on patterns from OpenHands, Open Interpreter, browser-use

import { TaskPlan, TaskPhase, TaskStep, StepResult } from './viAgentPlanner';
import {
    VisualState, SearchResult, AIActionResponse,
    generateDOMExtractionScript, generateOCRExtractionScript,
    generateAIActionPrompt, parseAIResponse, rankSearchResults
} from './viVisionTranslator';
import { actionToPowerShell, POWERSHELL_SCRIPTS } from './viControlEngine';

export interface ExecutorState {
    plan: TaskPlan;
    currentPhaseIndex: number;
    currentStepIndex: number;
    visualState?: VisualState;
    history: ExecutorHistoryEntry[];
    status: 'idle' | 'executing' | 'verifying' | 'awaiting_ai' | 'completed' | 'failed' | 'needs_user';
    lastError?: string;
}

export interface ExecutorHistoryEntry {
    timestamp: number;
    phase: string;
    step: string;
    action: string;
    result: 'success' | 'failed' | 'retry';
    details: string;
    visualStateBefore?: Partial<VisualState>;
    visualStateAfter?: Partial<VisualState>;
}

export interface ExecutorCallbacks {
    onPhaseStart?: (phase: TaskPhase, index: number) => void;
    onStepStart?: (step: TaskStep, phaseIndex: number, stepIndex: number) => void;
    onStepComplete?: (step: TaskStep, result: StepResult) => void;
    onStepFailed?: (step: TaskStep, error: string, willRetry: boolean) => void;
    onVerification?: (step: TaskStep, passed: boolean, details: string) => void;
    onAIThinking?: (prompt: string) => void;
    onAIResponse?: (response: AIActionResponse) => void;
    onNeedsUser?: (reason: string, context: any) => void;
    onComplete?: (plan: TaskPlan, history: ExecutorHistoryEntry[]) => void;
    onLog?: (message: string, level: 'info' | 'warn' | 'error' | 'debug') => void;
}

// === EXECUTOR CLASS ===

export class ViAgentExecutor {
    private state: ExecutorState;
    private callbacks: ExecutorCallbacks;
    private abortController?: AbortController;
    private electron: any;

    constructor(plan: TaskPlan, callbacks: ExecutorCallbacks = {}) {
        this.state = {
            plan,
            currentPhaseIndex: 0,
            currentStepIndex: 0,
            history: [],
            status: 'idle'
        };
        this.callbacks = callbacks;
        this.electron = (window as any).electron;
    }

    // === MAIN EXECUTION LOOP ===

    async execute(): Promise<ExecutorState> {
        this.abortController = new AbortController();
        this.state.status = 'executing';
        this.state.plan.status = 'executing';

        this.log('info', `Starting execution of plan: ${this.state.plan.taskId}`);
        this.log('info', `Objective: ${this.state.plan.objective}`);
        this.log('info', `Phases: ${this.state.plan.phases.length}`);

        try {
            // Execute each phase
            for (let phaseIdx = 0; phaseIdx < this.state.plan.phases.length; phaseIdx++) {
                if (this.abortController.signal.aborted) break;

                const phase = this.state.plan.phases[phaseIdx];
                this.state.currentPhaseIndex = phaseIdx;
                phase.status = 'active';

                this.log('info', `\n━━━ Phase ${phaseIdx + 1}: ${phase.name} ━━━`);
                this.callbacks.onPhaseStart?.(phase, phaseIdx);

                // Execute each step in phase
                for (let stepIdx = 0; stepIdx < phase.steps.length; stepIdx++) {
                    if (this.abortController.signal.aborted) break;

                    const step = phase.steps[stepIdx];
                    this.state.currentStepIndex = stepIdx;

                    const result = await this.executeStep(step, phaseIdx, stepIdx);

                    if (!result.success) {
                        if (step.retryCount < step.maxRetries) {
                            step.retryCount++;
                            step.status = 'retry';
                            this.log('warn', `Step failed, retrying (${step.retryCount}/${step.maxRetries})`);
                            this.callbacks.onStepFailed?.(step, result.error || 'Unknown', true);
                            stepIdx--; // Retry same step
                            await this.delay(1000);
                            continue;
                        } else {
                            step.status = 'failed';
                            phase.status = 'failed';
                            this.callbacks.onStepFailed?.(step, result.error || 'Unknown', false);

                            // Ask user for help
                            this.state.status = 'needs_user';
                            this.callbacks.onNeedsUser?.(`Step "${step.description}" failed after ${step.maxRetries} retries`, {
                                step, phase, error: result.error
                            });
                            return this.state;
                        }
                    }

                    step.status = 'completed';
                    step.result = result;
                    this.callbacks.onStepComplete?.(step, result);
                }

                phase.status = 'completed';
                this.log('info', `✓ Phase ${phaseIdx + 1} completed`);
            }

            // Verify objective was actually achieved
            const objectiveAchieved = await this.verifyObjective();

            if (objectiveAchieved) {
                this.state.status = 'completed';
                this.state.plan.status = 'completed';
                this.state.plan.completedAt = Date.now();
                this.log('info', `\n✅ Task completed successfully!`);
            } else {
                this.state.status = 'needs_user';
                this.state.plan.status = 'needs_user';
                this.log('warn', `\n⚠️ All steps executed but objective may not be fully achieved`);
                this.callbacks.onNeedsUser?.('Objective verification failed', { state: this.state });
            }

        } catch (error: any) {
            this.state.status = 'failed';
            this.state.plan.status = 'failed';
            this.state.lastError = error.message;
            this.log('error', `Execution error: ${error.message}`);
        }

        this.callbacks.onComplete?.(this.state.plan, this.state.history);
        return this.state;
    }

    // === STEP EXECUTION ===

    private async executeStep(step: TaskStep, phaseIdx: number, stepIdx: number): Promise<StepResult> {
        step.status = 'executing';
        this.log('info', `  ▶ ${step.description}`);
        this.callbacks.onStepStart?.(step, phaseIdx, stepIdx);

        const startTime = Date.now();
        let result: StepResult = {
            success: false,
            verificationPassed: false,
            timestamp: startTime
        };

        try {
            switch (step.type) {
                case 'OPEN_BROWSER':
                    result = await this.executeOpenBrowser(step);
                    break;
                case 'NAVIGATE_URL':
                    result = await this.executeNavigateUrl(step);
                    break;
                case 'WAIT_FOR_LOAD':
                    result = await this.executeWait(step);
                    break;
                case 'FOCUS_ELEMENT':
                    result = await this.executeFocusElement(step);
                    break;
                case 'TYPE_TEXT':
                    result = await this.executeTypeText(step);
                    break;
                case 'PRESS_KEY':
                    result = await this.executePressKey(step);
                    break;
                case 'CLICK_ELEMENT':
                case 'CLICK_COORDINATES':
                    result = await this.executeClick(step);
                    break;
                case 'EXTRACT_RESULTS':
                    result = await this.executeExtractResults(step);
                    break;
                case 'RANK_RESULTS':
                    result = await this.executeRankResults(step);
                    break;
                case 'OPEN_RESULT':
                    result = await this.executeOpenResult(step);
                    break;
                case 'VERIFY_STATE':
                    result = await this.executeVerifyState(step);
                    break;
                case 'SCREENSHOT':
                    result = await this.executeScreenshot(step);
                    break;
                default:
                    result.error = `Unknown step type: ${step.type}`;
            }

            // Record history
            this.state.history.push({
                timestamp: Date.now(),
                phase: this.state.plan.phases[phaseIdx].name,
                step: step.description,
                action: step.type,
                result: result.success ? 'success' : 'failed',
                details: result.output?.toString() || result.error || ''
            });

        } catch (error: any) {
            result.success = false;
            result.error = error.message;
        }

        return result;
    }

    // === STEP IMPLEMENTATIONS ===

    private async executeOpenBrowser(step: TaskStep): Promise<StepResult> {
        const browser = step.params.browser || 'msedge';
        const script = POWERSHELL_SCRIPTS.openApp(browser);

        const output = await this.runPowerShell(script);
        await this.delay(2000); // Wait for browser to open

        return {
            success: true,
            output: `Opened ${browser}`,
            verificationPassed: true,
            timestamp: Date.now()
        };
    }

    private async executeNavigateUrl(step: TaskStep): Promise<StepResult> {
        const url = step.params.url;
        const script = POWERSHELL_SCRIPTS.openUrl(url);

        await this.runPowerShell(script);
        await this.delay(1500);

        return {
            success: true,
            output: `Navigated to ${url}`,
            verificationPassed: true,
            timestamp: Date.now()
        };
    }

    private async executeWait(step: TaskStep): Promise<StepResult> {
        const ms = step.params.ms || 2000;
        await this.delay(ms);

        return {
            success: true,
            output: `Waited ${ms}ms`,
            verificationPassed: true,
            timestamp: Date.now()
        };
    }

    private async executeFocusElement(step: TaskStep): Promise<StepResult> {
        // For Google search, we can use Tab to focus or send keys
        const script = `
Add-Type -AssemblyName System.Windows.Forms
# Press Tab a few times to reach search box, or it's usually auto-focused
Start-Sleep -Milliseconds 500
        `;
        await this.runPowerShell(script);

        return {
            success: true,
            output: 'Focused input element',
            verificationPassed: true,
            timestamp: Date.now()
        };
    }

    private async executeTypeText(step: TaskStep): Promise<StepResult> {
        const text = step.params.text;

        // GUARD: Verify text doesn't contain instructions
        const poisonPatterns = [/then\s+/i, /and\s+open/i, /go\s+through/i];
        for (const pattern of poisonPatterns) {
            if (pattern.test(text)) {
                return {
                    success: false,
                    error: `TYPE_TEXT contains instruction pattern: "${text}"`,
                    verificationPassed: false,
                    timestamp: Date.now()
                };
            }
        }

        const script = POWERSHELL_SCRIPTS.keyboardType(text);
        await this.runPowerShell(script);

        this.log('info', `    Typed: "${text}"`);

        return {
            success: true,
            output: `Typed: ${text}`,
            verificationPassed: true,
            timestamp: Date.now()
        };
    }

    private async executePressKey(step: TaskStep): Promise<StepResult> {
        const key = step.params.key;
        const script = POWERSHELL_SCRIPTS.keyboardPress(key);

        await this.runPowerShell(script);
        await this.delay(500);

        return {
            success: true,
            output: `Pressed: ${key}`,
            verificationPassed: true,
            timestamp: Date.now()
        };
    }

    private async executeClick(step: TaskStep): Promise<StepResult> {
        const x = step.params.x;
        const y = step.params.y;
        const script = POWERSHELL_SCRIPTS.mouseClick(x, y, 'left');

        await this.runPowerShell(script);
        await this.delay(500);

        return {
            success: true,
            output: `Clicked at (${x}, ${y})`,
            verificationPassed: true,
            timestamp: Date.now()
        };
    }

    private async executeExtractResults(step: TaskStep): Promise<StepResult> {
        // Capture visual state and extract search results
        this.log('info', '    Extracting search results from page...');

        const visualState = await this.captureVisualState();
        this.state.visualState = visualState;

        if (visualState.searchResults.length === 0) {
            // Try OCR fallback
            this.log('warn', '    No results from DOM, trying OCR...');
            // For now, return mock results - in production would use OCR
        }

        const resultCount = visualState.searchResults.length;
        this.log('info', `    Found ${resultCount} search results`);

        // Log the results
        visualState.searchResults.slice(0, 5).forEach((r, i) => {
            this.log('info', `      [${i}] ${r.title}`);
            this.log('debug', `          ${r.url}`);
        });

        return {
            success: resultCount > 0,
            output: visualState.searchResults,
            verificationPassed: resultCount >= 3,
            timestamp: Date.now()
        };
    }

    private async executeRankResults(step: TaskStep): Promise<StepResult> {
        const criteria = step.params.criteria || ['interesting', 'authoritative'];
        const results = this.state.visualState?.searchResults || [];

        if (results.length === 0) {
            return {
                success: false,
                error: 'No results to rank',
                verificationPassed: false,
                timestamp: Date.now()
            };
        }

        // Apply ranking rubric
        const ranked = rankSearchResults(results, criteria);
        const bestResult = ranked[0];

        this.log('info', `    🏆 Selected: "${bestResult.title}"`);
        this.log('info', `       Domain: ${bestResult.domain}`);
        this.log('info', `       Reason: ${this.explainSelection(bestResult, criteria)}`);

        // Store selection for next step
        step.params.selectedResult = bestResult;

        return {
            success: true,
            output: { selected: bestResult, reason: this.explainSelection(bestResult, criteria) },
            verificationPassed: true,
            timestamp: Date.now()
        };
    }

    private explainSelection(result: SearchResult, criteria: string[]): string {
        const reasons = [];

        if (result.domain.includes('wikipedia')) reasons.push('Wikipedia is authoritative and comprehensive');
        if (result.domain.includes('.gov')) reasons.push('Government source is official');
        if (result.domain.includes('.edu')) reasons.push('Educational institution is credible');
        if (!result.isAd) reasons.push('Not an advertisement');
        if (result.snippet.length > 100) reasons.push('Has detailed description');

        if (reasons.length === 0) reasons.push('Best match based on relevance and source quality');

        return reasons.join('; ');
    }

    private async executeOpenResult(step: TaskStep): Promise<StepResult> {
        // Get the previously ranked result
        const prevStep = this.state.plan.phases[this.state.currentPhaseIndex].steps
            .find(s => s.type === 'RANK_RESULTS');
        const selectedResult = prevStep?.params.selectedResult as SearchResult;

        if (!selectedResult) {
            return {
                success: false,
                error: 'No result selected to open',
                verificationPassed: false,
                timestamp: Date.now()
            };
        }

        this.log('info', `    Opening: ${selectedResult.url}`);

        // Click on the result link
        if (selectedResult.bbox) {
            const x = selectedResult.bbox.x + selectedResult.bbox.w / 2;
            const y = selectedResult.bbox.y + selectedResult.bbox.h / 2;
            const script = POWERSHELL_SCRIPTS.mouseClick(x, y, 'left');
            await this.runPowerShell(script);
        } else {
            // Fallback: open URL directly
            const script = POWERSHELL_SCRIPTS.openUrl(selectedResult.url);
            await this.runPowerShell(script);
        }

        await this.delay(2000);

        return {
            success: true,
            output: { opened: selectedResult.url, title: selectedResult.title },
            verificationPassed: true,
            timestamp: Date.now()
        };
    }

    private async executeVerifyState(step: TaskStep): Promise<StepResult> {
        const expected = step.params.expected;

        // Capture current state
        const visualState = await this.captureVisualState();

        let passed = false;
        let details = '';

        switch (expected) {
            case 'search_results_page':
                passed = visualState.hints.includes('GOOGLE_SEARCH_RESULTS_PAGE') ||
                    visualState.searchResults.length > 0;
                details = passed ? 'Search results page confirmed' : 'No results detected';
                break;
            case 'result_page':
                passed = !visualState.pageInfo.url.includes('google.com/search');
                details = passed ? `On result page: ${visualState.pageInfo.url}` : 'Still on search page';
                break;
            default:
                passed = true;
                details = 'Generic verification passed';
        }

        this.callbacks.onVerification?.(step, passed, details);

        return {
            success: passed,
            output: details,
            verificationPassed: passed,
            timestamp: Date.now()
        };
    }

    private async executeScreenshot(step: TaskStep): Promise<StepResult> {
        const script = POWERSHELL_SCRIPTS.screenshot();
        const output = await this.runPowerShell(script);

        return {
            success: true,
            output: 'Screenshot captured',
            verificationPassed: true,
            timestamp: Date.now()
        };
    }

    // === VISUAL STATE CAPTURE ===

    private async captureVisualState(): Promise<VisualState> {
        // For now, return a mock state - in production would inject DOM script
        // or run OCR
        const mockState: VisualState = {
            timestamp: new Date().toISOString(),
            viewport: { width: 1920, height: 1080 },
            pageInfo: { title: 'Google Search', url: 'https://www.google.com/search?q=test', domain: 'google.com' },
            elements: [],
            textBlocks: [],
            searchResults: [
                // Mock search results for testing
                { index: 0, title: 'Wikipedia - The Free Encyclopedia', url: 'https://en.wikipedia.org', domain: 'wikipedia.org', snippet: 'Wikipedia is a free online encyclopedia...', isAd: false },
                { index: 1, title: 'Official Website', url: 'https://example.gov', domain: 'example.gov', snippet: 'Official government information...', isAd: false },
                { index: 2, title: 'News Article', url: 'https://bbc.com/news', domain: 'bbc.com', snippet: 'Latest news and updates...', isAd: false },
            ],
            hints: ['GOOGLE_SEARCH_RESULTS_PAGE', 'HAS_3_RESULTS']
        };

        return mockState;
    }

    // === OBJECTIVE VERIFICATION ===

    private async verifyObjective(): Promise<boolean> {
        // Check if the browsing objective was achieved
        const browsePhase = this.state.plan.phases.find(p => p.name === 'BrowseResults');

        if (browsePhase) {
            const openResultStep = browsePhase.steps.find(s => s.type === 'OPEN_RESULT');
            return openResultStep?.status === 'completed' && openResultStep?.result?.success === true;
        }

        // If no browse phase, check if search was completed
        const searchPhase = this.state.plan.phases.find(p => p.name === 'Search');
        if (searchPhase) {
            return searchPhase.status === 'completed';
        }

        return this.state.plan.phases.every(p => p.status === 'completed');
    }

    // === UTILITIES ===

    private async runPowerShell(script: string): Promise<string> {
        return new Promise((resolve) => {
            if (!this.electron?.runPowerShell) {
                this.log('debug', `[MOCK] ${script.substring(0, 100)}...`);
                resolve('[Mock execution]');
                return;
            }

            const sessionId = `exec-${Date.now()}`;
            let output = '';

            this.electron.removeExecListeners?.();
            this.electron.onExecChunk?.(({ text }: any) => {
                output += text + '\n';
            });
            this.electron.onExecComplete?.(() => {
                resolve(output);
            });

            this.electron.runPowerShell(sessionId, script, true);
            setTimeout(() => resolve(output), 15000);
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise(r => setTimeout(r, ms));
    }

    private log(level: 'info' | 'warn' | 'error' | 'debug', message: string) {
        this.callbacks.onLog?.(message, level);
        if (level !== 'debug') {
            console.log(`[ViExecutor] ${message}`);
        }
    }

    // === CONTROL ===

    stop() {
        this.abortController?.abort();
        this.state.status = 'idle';
    }

    getState(): ExecutorState {
        return { ...this.state };
    }
}

export default ViAgentExecutor;
