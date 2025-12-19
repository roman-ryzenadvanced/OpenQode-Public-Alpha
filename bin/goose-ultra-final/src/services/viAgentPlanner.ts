// Vi Agent Planner - Hierarchical Task Planning
// Converts user requests into structured TaskPlans with phases
// Implements guard rails to prevent typing instructions

export interface TaskPhase {
    name: string;
    description: string;
    steps: TaskStep[];
    status: 'pending' | 'active' | 'completed' | 'failed';
    successCriteria: string[];
}

export interface TaskStep {
    id: string;
    type: StepType;
    params: Record<string, any>;
    description: string;
    status: 'pending' | 'executing' | 'verifying' | 'completed' | 'failed' | 'retry';
    successCriteria: string[];
    retryCount: number;
    maxRetries: number;
    result?: StepResult;
}

export type StepType =
    | 'OPEN_BROWSER'
    | 'NAVIGATE_URL'
    | 'WAIT_FOR_LOAD'
    | 'FOCUS_ELEMENT'
    | 'TYPE_TEXT'
    | 'PRESS_KEY'
    | 'CLICK_ELEMENT'
    | 'CLICK_COORDINATES'
    | 'EXTRACT_RESULTS'
    | 'RANK_RESULTS'
    | 'OPEN_RESULT'
    | 'VERIFY_STATE'
    | 'SCREENSHOT'
    | 'ASK_USER';

export interface StepResult {
    success: boolean;
    output?: any;
    error?: string;
    verificationPassed: boolean;
    timestamp: number;
}

export interface TaskPlan {
    taskId: string;
    objective: string;
    originalInput: string;
    phases: TaskPhase[];
    status: 'planning' | 'executing' | 'completed' | 'failed' | 'needs_user';
    constraints: string[];
    createdAt: number;
    completedAt?: number;
}

export interface ParsedIntent {
    searchQuery?: string;           // EXACT query text only
    targetUrl?: string;             // URL to navigate to
    applicationToOpen?: string;     // App to launch
    browsingObjective?: string;     // What to do after search (e.g., "find most interesting")
    selectionCriteria?: string[];   // How to choose results
    hasFollowUpAction: boolean;
}

// === INTENT PARSER ===
// Strictly separates query text from follow-up actions

const FOLLOW_UP_PATTERNS = [
    /,?\s*then\s+(.+)/i,
    /,?\s*and\s+then\s+(.+)/i,
    /,?\s*after\s+that\s+(.+)/i,
    /,?\s*and\s+(?:go\s+through|look\s+at|browse|analyze|find|choose|select|pick|open\s+the)\s+(.+)/i,
];

const INSTRUCTION_POISON_PATTERNS = [
    /then\s+go\s+through/i,
    /then\s+open\s+the/i,
    /and\s+open\s+the\s+one/i,
    /go\s+through\s+results/i,
    /open\s+the\s+most/i,
    /find\s+the\s+most/i,
    /choose\s+the\s+best/i,
    /pick\s+one/i,
    /select\s+the/i,
];

export function parseUserIntent(input: string): ParsedIntent {
    const intent: ParsedIntent = {
        hasFollowUpAction: false
    };

    let remaining = input.trim();

    // Step 1: Extract follow-up actions FIRST
    for (const pattern of FOLLOW_UP_PATTERNS) {
        const match = remaining.match(pattern);
        if (match) {
            intent.browsingObjective = match[1].trim();
            intent.hasFollowUpAction = true;
            remaining = remaining.replace(pattern, '').trim();
            break;
        }
    }

    // Step 2: Extract search query - be VERY strict about what goes in
    const searchPatterns = [
        /search\s+(?:for\s+)?["']([^"']+)["']/i,     // search for "query"
        /search\s+(?:for\s+)?(\w+)(?:\s|$|,)/i,       // search for WORD (single word only)
        /search\s+(?:for\s+)?([^,]+?)(?:,|then|and\s+then|$)/i,  // search for query, then...
    ];

    for (const pattern of searchPatterns) {
        const match = remaining.match(pattern);
        if (match) {
            let query = match[1].trim();

            // GUARD: Remove any instruction poison from query
            for (const poison of INSTRUCTION_POISON_PATTERNS) {
                if (poison.test(query)) {
                    // Truncate at the poison pattern
                    query = query.replace(poison, '').trim();
                    intent.hasFollowUpAction = true;
                }
            }

            // Clean up trailing conjunctions
            query = query.replace(/,?\s*(then|and)?\s*$/i, '').trim();

            if (query.length > 0 && query.length < 100) {
                intent.searchQuery = query;
            }
            break;
        }
    }

    // Step 3: Extract URL
    const urlMatch = remaining.match(/(?:go\s+to|open|navigate\s+to|visit)\s+(\S+\.(?:com|org|net|io|dev|ai|gov|edu)\S*)/i);
    if (urlMatch) {
        let url = urlMatch[1];
        if (!url.startsWith('http')) url = 'https://' + url;
        intent.targetUrl = url;
    }

    // Step 4: Extract application
    const appPatterns: { pattern: RegExp; app: string }[] = [
        { pattern: /open\s+edge/i, app: 'msedge' },
        { pattern: /open\s+chrome/i, app: 'chrome' },
        { pattern: /open\s+firefox/i, app: 'firefox' },
        { pattern: /open\s+notepad/i, app: 'notepad' },
    ];

    for (const { pattern, app } of appPatterns) {
        if (pattern.test(remaining)) {
            intent.applicationToOpen = app;
            break;
        }
    }

    // Step 5: Extract selection criteria
    if (intent.browsingObjective) {
        const criteriaPatterns = [
            { pattern: /most\s+interesting/i, criteria: 'interesting' },
            { pattern: /most\s+relevant/i, criteria: 'relevant' },
            { pattern: /best/i, criteria: 'best' },
            { pattern: /first/i, criteria: 'first' },
            { pattern: /official/i, criteria: 'official' },
            { pattern: /wikipedia/i, criteria: 'wikipedia' },
        ];

        intent.selectionCriteria = [];
        for (const { pattern, criteria } of criteriaPatterns) {
            if (pattern.test(intent.browsingObjective)) {
                intent.selectionCriteria.push(criteria);
            }
        }
    }

    return intent;
}

// === PLAN GENERATOR ===
// Creates hierarchical TaskPlan from ParsedIntent

export function generateTaskPlan(input: string): TaskPlan {
    const intent = parseUserIntent(input);
    const taskId = `task-${Date.now()}`;

    const plan: TaskPlan = {
        taskId,
        objective: input,
        originalInput: input,
        phases: [],
        status: 'planning',
        constraints: [
            'TypedText must be EXACT query only - never include instructions',
            'Each phase must verify success before proceeding',
            'Browsing requires extracting and ranking results'
        ],
        createdAt: Date.now()
    };

    // Phase 1: Navigate (if URL or browser needed)
    if (intent.applicationToOpen || intent.targetUrl) {
        const navigatePhase: TaskPhase = {
            name: 'Navigate',
            description: 'Open browser and navigate to target',
            status: 'pending',
            successCriteria: ['Browser window is open', 'Target page is loaded'],
            steps: []
        };

        if (intent.applicationToOpen) {
            navigatePhase.steps.push({
                id: `${taskId}-nav-1`,
                type: 'OPEN_BROWSER',
                params: { browser: intent.applicationToOpen },
                description: `Open ${intent.applicationToOpen}`,
                status: 'pending',
                successCriteria: ['Browser process started'],
                retryCount: 0,
                maxRetries: 2
            });
        }

        if (intent.targetUrl) {
            navigatePhase.steps.push({
                id: `${taskId}-nav-2`,
                type: 'NAVIGATE_URL',
                params: { url: intent.targetUrl },
                description: `Navigate to ${intent.targetUrl}`,
                status: 'pending',
                successCriteria: ['URL matches target', 'Page content loaded'],
                retryCount: 0,
                maxRetries: 2
            });

            navigatePhase.steps.push({
                id: `${taskId}-nav-3`,
                type: 'WAIT_FOR_LOAD',
                params: { ms: 2000 },
                description: 'Wait for page to fully load',
                status: 'pending',
                successCriteria: ['Page is interactive'],
                retryCount: 0,
                maxRetries: 1
            });
        }

        plan.phases.push(navigatePhase);
    }

    // Phase 2: Search (if query exists)
    if (intent.searchQuery) {
        const searchPhase: TaskPhase = {
            name: 'Search',
            description: `Search for: "${intent.searchQuery}"`,
            status: 'pending',
            successCriteria: ['Search query entered', 'Results page loaded'],
            steps: [
                {
                    id: `${taskId}-search-1`,
                    type: 'FOCUS_ELEMENT',
                    params: { selector: 'input[name="q"], input[type="search"], textarea[name="q"]' },
                    description: 'Focus search input field',
                    status: 'pending',
                    successCriteria: ['Search input is focused'],
                    retryCount: 0,
                    maxRetries: 2
                },
                {
                    id: `${taskId}-search-2`,
                    type: 'TYPE_TEXT',
                    params: {
                        text: intent.searchQuery, // ONLY the query, never instructions!
                        verify: true
                    },
                    description: `Type search query: "${intent.searchQuery}"`,
                    status: 'pending',
                    successCriteria: [`Input contains: ${intent.searchQuery}`],
                    retryCount: 0,
                    maxRetries: 1
                },
                {
                    id: `${taskId}-search-3`,
                    type: 'PRESS_KEY',
                    params: { key: 'enter' },
                    description: 'Submit search',
                    status: 'pending',
                    successCriteria: ['Page navigation occurred'],
                    retryCount: 0,
                    maxRetries: 1
                },
                {
                    id: `${taskId}-search-4`,
                    type: 'WAIT_FOR_LOAD',
                    params: { ms: 2000 },
                    description: 'Wait for search results',
                    status: 'pending',
                    successCriteria: ['Results container visible'],
                    retryCount: 0,
                    maxRetries: 1
                },
                {
                    id: `${taskId}-search-5`,
                    type: 'VERIFY_STATE',
                    params: {
                        expected: 'search_results_page',
                        indicators: ['Results count', 'Result links present']
                    },
                    description: 'Verify search results loaded',
                    status: 'pending',
                    successCriteria: ['Search results are visible'],
                    retryCount: 0,
                    maxRetries: 2
                }
            ]
        };

        plan.phases.push(searchPhase);
    }

    // Phase 3: Browse Results (if follow-up action exists)
    if (intent.hasFollowUpAction && intent.browsingObjective) {
        const browsePhase: TaskPhase = {
            name: 'BrowseResults',
            description: intent.browsingObjective,
            status: 'pending',
            successCriteria: ['Results extracted', 'Best result identified', 'Result page opened'],
            steps: [
                {
                    id: `${taskId}-browse-1`,
                    type: 'EXTRACT_RESULTS',
                    params: {
                        maxResults: 10,
                        extractFields: ['title', 'url', 'snippet', 'domain']
                    },
                    description: 'Extract search results list',
                    status: 'pending',
                    successCriteria: ['At least 3 results extracted'],
                    retryCount: 0,
                    maxRetries: 2
                },
                {
                    id: `${taskId}-browse-2`,
                    type: 'RANK_RESULTS',
                    params: {
                        criteria: intent.selectionCriteria || ['interesting', 'authoritative'],
                        rubric: [
                            'Prefer Wikipedia, reputable news, official docs',
                            'Prefer unique angle over generic',
                            'Avoid ads and low-quality domains',
                            'Match relevance to query'
                        ]
                    },
                    description: 'Rank results and select best',
                    status: 'pending',
                    successCriteria: ['Result selected with explanation'],
                    retryCount: 0,
                    maxRetries: 1
                },
                {
                    id: `${taskId}-browse-3`,
                    type: 'OPEN_RESULT',
                    params: { resultIndex: 0 }, // Will be updated after ranking
                    description: 'Open selected result',
                    status: 'pending',
                    successCriteria: ['New page loaded', 'URL changed from search page'],
                    retryCount: 0,
                    maxRetries: 2
                },
                {
                    id: `${taskId}-browse-4`,
                    type: 'VERIFY_STATE',
                    params: {
                        expected: 'result_page',
                        indicators: ['URL is not Google', 'Page content loaded']
                    },
                    description: 'Verify result page opened',
                    status: 'pending',
                    successCriteria: ['Successfully navigated to result'],
                    retryCount: 0,
                    maxRetries: 1
                }
            ]
        };

        plan.phases.push(browsePhase);
    }

    return plan;
}

// === PLAN VALIDATOR ===
// Ensures plan doesn't violate constraints

export function validatePlan(plan: TaskPlan): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const phase of plan.phases) {
        for (const step of phase.steps) {
            // Check TYPE_TEXT steps for instruction poisoning
            if (step.type === 'TYPE_TEXT') {
                const text = step.params.text || '';

                for (const poison of INSTRUCTION_POISON_PATTERNS) {
                    if (poison.test(text)) {
                        errors.push(`TYPE_TEXT contains instruction: "${text}" - this should only be the search query`);
                    }
                }

                // Check for suspicious length (query shouldn't be a paragraph)
                if (text.length > 50) {
                    errors.push(`TYPE_TEXT suspiciously long (${text.length} chars) - may contain instructions`);
                }

                // Check for commas followed by words (likely instructions)
                if (/,\s*\w+\s+\w+/.test(text) && text.split(',').length > 2) {
                    errors.push(`TYPE_TEXT contains multiple comma-separated clauses - may contain instructions`);
                }
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

// === PLAN PRETTY PRINTER ===

export function formatPlanForDisplay(plan: TaskPlan): string {
    let output = `📋 Task Plan: ${plan.taskId}\n`;
    output += `🎯 Objective: ${plan.objective}\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (let i = 0; i < plan.phases.length; i++) {
        const phase = plan.phases[i];
        const phaseIcon = phase.status === 'completed' ? '✅' :
            phase.status === 'active' ? '🔄' :
                phase.status === 'failed' ? '❌' : '⏳';

        output += `${phaseIcon} Phase ${i + 1}: ${phase.name}\n`;
        output += `   ${phase.description}\n`;

        for (let j = 0; j < phase.steps.length; j++) {
            const step = phase.steps[j];
            const stepIcon = step.status === 'completed' ? '✓' :
                step.status === 'executing' ? '►' :
                    step.status === 'failed' ? '✗' : '○';

            output += `   ${stepIcon} ${j + 1}. ${step.description}\n`;
        }
        output += '\n';
    }

    return output;
}

export default {
    parseUserIntent,
    generateTaskPlan,
    validatePlan,
    formatPlanForDisplay
};
