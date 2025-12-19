import { SkillManifest, SkillRegistry, SkillRunRequest, SkillRunResult, SkillPermission } from '../types';

// Mock catalog for offline/default state (P0 Auto-fetch spec says "baked-in minimal catalog")
const DEFAULT_CATALOG: SkillManifest[] = [
    {
        id: 'web-search',
        name: 'Web Search',
        description: 'Search the internet for real-time information.',
        category: 'Research',
        version: '1.0.0',
        permissions: ['network'],
        inputsSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'The search query' }
            },
            required: ['query']
        },
        outputsSchema: { type: 'string' },
        entrypoint: { type: 'api_call', uri: 'search' },
        icon: 'Globe'
    },
    {
        id: 'charts',
        name: 'Data Charts',
        description: 'Add interactive charts and graphs for dashboards and analytics.',
        category: 'Frontend',
        version: '2.0.0',
        permissions: ['none'],
        inputsSchema: {},
        outputsSchema: {},
        entrypoint: { type: 'api_call', uri: 'chart.js' },
        icon: 'PieChart'
    },
    {
        id: 'threejs',
        name: '3D Engine',
        description: 'Render high-performance 3D graphics, games, and animations.',
        category: 'Graphics',
        version: '1.0.0',
        permissions: ['none'],
        inputsSchema: {},
        outputsSchema: {},
        entrypoint: { type: 'api_call', uri: 'three' },
        icon: 'Box' // Using Box as placeholder for 3D
    },
    {
        id: 'maps',
        name: 'Interactive Maps',
        description: 'Embed dynamic maps for location-based applications.',
        category: 'Frontend',
        version: '1.0.0',
        permissions: ['network'],
        inputsSchema: {},
        outputsSchema: {},
        entrypoint: { type: 'api_call', uri: 'leaflet' },
        icon: 'Globe'
    },
    {
        id: 'auth',
        name: 'User Auth',
        description: 'Secure login, registration, and user management flows.',
        category: 'Backend',
        version: '1.0.0',
        permissions: ['network'],
        inputsSchema: {},
        outputsSchema: {},
        entrypoint: { type: 'api_call', uri: 'firebase' },
        icon: 'ShieldAlert'
    },
    {
        id: 'payments',
        name: 'Payments',
        description: 'Process secure transactions for e-commerce and stores.',
        category: 'Backend',
        version: '1.0.0',
        permissions: ['network'],
        inputsSchema: {},
        outputsSchema: {},
        entrypoint: { type: 'api_call', uri: 'stripe' },
        icon: 'CreditCard'
    },
    {
        id: 'calculator',
        name: 'Scientific Calculator',
        description: 'Perform complex mathematical calculations.',
        category: 'Utility',
        version: '1.0.0',
        permissions: ['none'],
        inputsSchema: {
            type: 'object',
            properties: {
                expression: { type: 'string', description: 'Math expression' }
            },
            required: ['expression']
        },
        outputsSchema: { type: 'number' },
        entrypoint: { type: 'js_script', uri: 'eval' },
        icon: 'Cpu'
    }
];

export class SkillsService {
    private registry: SkillRegistry = {
        catalog: [],
        installed: [],
        personaOverrides: {},
        lastUpdated: 0
    };

    private electron = (window as any).electron;
    private isLoaded = false;
    private loadPromise: Promise<void> | null = null;

    constructor() {
        this.loadPromise = this.loadRegistry();
    }

    // Ensure registry is loaded before accessing
    public async ensureLoaded(): Promise<void> {
        if (this.loadPromise) {
            await this.loadPromise;
        }
    }

    private async loadRegistry() {
        // First try to load from localStorage (sync, fast)
        try {
            const saved = localStorage.getItem('goose_skills_installed');
            if (saved) {
                const installedIds = JSON.parse(saved) as string[];
                // We'll populate installed after catalog is set
                this.registry.catalog = DEFAULT_CATALOG;
                this.registry.installed = this.registry.catalog.filter(s => installedIds.includes(s.id));
            } else {
                this.registry.catalog = DEFAULT_CATALOG;
            }
        } catch (e) {
            console.warn('[SkillsService] Failed to load from localStorage', e);
            this.registry.catalog = DEFAULT_CATALOG;
        }

        // Then try Electron FS if available
        if (this.electron?.fs) {
            try {
                const content = await this.electron.fs.read('skills/registry.json').catch(() => null);
                if (content) {
                    const loaded = JSON.parse(content);
                    this.registry = loaded;
                }
            } catch (e) {
                console.warn('[SkillsService] Failed to load registry from disk', e);
            }
        }

        this.isLoaded = true;
    }

    private async saveRegistry() {
        this.registry.lastUpdated = Date.now();

        // Always save installed skills IDs to localStorage for persistence
        try {
            const installedIds = this.registry.installed.map(s => s.id);
            localStorage.setItem('goose_skills_installed', JSON.stringify(installedIds));
        } catch (e) {
            console.warn('[SkillsService] Failed to save to localStorage', e);
        }

        // Also save full registry to Electron FS if available
        if (this.electron?.fs) {
            await this.electron.fs.write('skills/registry.json', JSON.stringify(this.registry, null, 2));
        } else {
            localStorage.setItem('goose_skills_registry', JSON.stringify(this.registry));
        }
    }

    public getCatalog(): SkillManifest[] {
        return this.registry.catalog;
    }

    public getInstalled(): SkillManifest[] {
        return this.registry.installed;
    }

    public isInstalled(skillId: string): boolean {
        return this.registry.installed.some(s => s.id === skillId);
    }

    // P0: Auto-fetch from upstream
    // "fetch_method": "GitHub Contents API"
    public async refreshCatalogFromUpstream(): Promise<SkillManifest[]> {
        console.log('[SkillsService] Refreshing catalog from upstream...');
        // Using GitHub API to fetch the tree from the specified commit
        const OWNER = 'anthropics';
        const REPO = 'skills';
        const COMMIT = 'f232228244495c018b3c1857436cf491ebb79bbb';
        const PATH = 'skills';

        try {
            // 1. Fetch File List
            // Note: In a real Electron app, we should use net module to avoid CORS if possible,
            // but github api is usually friendly. 
            // If CORS fails, we are stuck unless we use a proxy or window.electron.request (if exists).
            // We'll try fetch first.
            const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${COMMIT}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`GitHub API Error: ${res.statusText}`);

            const entries = await res.json();
            const manifests: SkillManifest[] = [];

            // 2. For each folder, try to fetch 'manifest.json' or assume it's a python file?
            // Anthropic skills repo structure (at that commit): folders like 'basketball', 'stock-market'
            // Inside each: usually a python file. They don't have a standardized 'manifest.json' in that repo yet (it's mostly .py files).
            // PROMPT says: "Identify the current data model...". 
            // Since the upstream doesn't have our Strict JSON, we must ADAPT/WRAP them.
            // We will fetch the list of folders.

            for (const entry of entries) {
                if (entry.type === 'dir') {
                    // It's a skill folder. We create a placeholder manifest.
                    // In a real implementation we would fetch the README or .py to infer schema.
                    // For this P0, we will synthesize a manifest based on the directory name.
                    const skillId = entry.name;
                    manifests.push({
                        id: skillId,
                        name: skillId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        description: `Anthropic Skill: ${skillId} (Auto-imported)`,
                        category: 'Anthropic',
                        version: '0.0.1',
                        permissions: ['network'], // Assume network for safety
                        inputsSchema: { type: 'object', properties: { input: { type: 'string' } } }, // Generic
                        outputsSchema: { type: 'string' },
                        entrypoint: { type: 'python_script', uri: `${entry.path}/${skillId}.py` }, // Guess
                        sourceUrl: entry.html_url,
                        commitHash: COMMIT,
                        icon: 'Terminal'
                    });
                }
            }

            // Merge with existing catalog (keep manual ones)
            // Actually, we should merge carefully.
            this.registry.catalog = [...DEFAULT_CATALOG, ...manifests];
            await this.saveRegistry();
            return this.registry.catalog;

        } catch (e) {
            console.error('[SkillsService] Failed to refresh catalog', e);
            throw e;
        }
    }

    public async installSkill(skillId: string): Promise<void> {
        const skill = this.registry.catalog.find(s => s.id === skillId);
        if (!skill) throw new Error("Skill not found in catalog");

        if (!this.registry.installed.some(s => s.id === skillId)) {
            this.registry.installed.push(skill);
            await this.saveRegistry();
        }
    }

    public async uninstallSkill(skillId: string): Promise<void> {
        this.registry.installed = this.registry.installed.filter(s => s.id !== skillId);
        await this.saveRegistry();
    }

    public async registerSkill(skill: SkillManifest): Promise<void> {
        // Remove existing if update
        this.registry.catalog = this.registry.catalog.filter(s => s.id !== skill.id);
        this.registry.catalog.push(skill);

        // Auto-install custom skills
        if (!this.registry.installed.some(s => s.id === skill.id)) {
            this.registry.installed.push(skill);
        }
        await this.saveRegistry();
    }

    // P0: Safe Execution
    public async runSkill(req: SkillRunRequest): Promise<SkillRunResult> {
        const skill = this.registry.installed.find(s => s.id === req.skillId);
        if (!skill) {
            // Check generic defaults
            const def = DEFAULT_CATALOG.find(s => s.id === req.skillId);
            if (!def) return { runId: req.runId, success: false, output: null, logs: [], error: 'Skill not installed', durationMs: 0 };
        }

        const start = Date.now();
        console.log(`[SkillsService] Request to run ${req.skillId}`, req.inputs);

        // Permissions Check (Mock UI Prompt)
        // In real app, we show a Modal. Here we use window.confirm as strict P0 requirement says "User sees permission prompt".
        // Note: window.confirm is blocking.
        // If "safe_by_default" is true, we always prompt unless "none" permission.
        const permissions = skill?.permissions || ['none'];
        if (!permissions.includes('none')) {
            const approved = window.confirm(`Allow skill '${req.skillId}' to execute?\nPermissions: ${permissions.join(', ')}`);
            if (!approved) {
                return { runId: req.runId, success: false, output: null, logs: ['User denied permission'], error: 'User denied permission', durationMs: Date.now() - start };
            }
        }

        try {
            // Execution Logic
            let output: any = null;

            // 1. Web Search
            if (req.skillId === 'web-search') {
                output = "Simulating Web Search for: " + req.inputs.query + "\n- Result 1: ...\n- Result 2: ...";
            }
            // 2. Calculator
            else if (req.skillId === 'calculator') {
                // Safe-ish eval
                try {
                    // eslint-disable-next-line no-new-func
                    output = new Function('return ' + req.inputs.expression)();
                } catch (e: any) {
                    throw new Error("Math Error: " + e.message);
                }
            }
            // 3. Fallback / Generic
            else {
                output = `Executed ${req.skillId} successfully. (Mock Result)`;
            }

            return {
                runId: req.runId,
                success: true,
                output,
                logs: [`Executed ${req.skillId}`],
                durationMs: Date.now() - start
            };

        } catch (e: any) {
            return {
                runId: req.runId,
                success: false,
                output: null,
                logs: [],
                error: e.message,
                durationMs: Date.now() - start
            };
        }
    }
}

export const skillsService = new SkillsService();
