/**
 * LAYER 6: Context-Locked Incremental Engine (CLIE)
 * 
 * Philosophy: Semantic Memory (Brain) + Mechanical Constraints (Hands)
 * 
 * This module enforces context preservation across all AI operations:
 * - REPAIR_MODE: Only fix bugs, NEVER change styling/layout
 * - FEATURE_MODE: Add new components while inheriting design tokens
 * - Vibe Guard: Prevent catastrophic redesigns by detecting DOM drift
 */

import { Project } from '../types';

// --- Types ---

export interface ProjectManifest {
    projectId: string;
    projectName: string;
    originalPrompt: string;
    coreIntent: string;
    nonNegotiableFeatures: string[];
    designTokens: {
        primaryColor?: string;
        secondaryColor?: string;
        fontFamily?: string;
        borderRadius?: string;
    };
    createdAt: number;
    lastUpdatedAt: number;
}

export interface CurrentState {
    htmlSnapshot: string;
    cssSnapshot: string;
    domStructureHash: string;
    styleSignature: string;
    lastModifiedAt: number;
}

export interface InteractionRecord {
    id: string;
    timestamp: number;
    userPrompt: string;
    mode: 'REPAIR_MODE' | 'FEATURE_MODE' | 'FULL_REGEN';
    whatChanged: string;
    contextPreserved: boolean;
    domDriftPercent: number;
}

export interface InteractionHistory {
    records: InteractionRecord[];
    totalInteractions: number;
    lastInteractionAt: number;
}

export type ExecutionMode = 'REPAIR_MODE' | 'FEATURE_MODE' | 'FULL_REGEN';

export interface IntentAnalysis {
    mode: ExecutionMode;
    confidence: number;
    reasoning: string;
    constraints: string[];
    allowedActions: string[];
    forbiddenActions: string[];
}

// --- Intent Classification ---

const REPAIR_KEYWORDS = [
    'fix', 'repair', 'debug', 'broken', 'bug', 'issue', 'error', 'wrong',
    'not working', 'doesn\'t work', 'crash', 'failing', 'glitch', 'typo',
    'correct', 'patch', 'hotfix', 'resolve', 'troubleshoot'
];

const FEATURE_KEYWORDS = [
    'add', 'create', 'new', 'implement', 'build', 'make', 'include',
    'integrate', 'extend', 'enhance', 'upgrade', 'feature', 'component'
];

const REGEN_KEYWORDS = [
    'redesign', 'rebuild', 'rewrite', 'start over', 'from scratch',
    'completely new', 'overhaul', 'redo', 'fresh start', 'scrap'
];

export function classifyIntent(prompt: string): IntentAnalysis {
    const lower = prompt.toLowerCase();

    // Check for explicit regeneration request
    const regenScore = REGEN_KEYWORDS.filter(k => lower.includes(k)).length;
    if (regenScore >= 2 || lower.includes('from scratch') || lower.includes('start over')) {
        return {
            mode: 'FULL_REGEN',
            confidence: 0.9,
            reasoning: 'User explicitly requested a complete redesign',
            constraints: [],
            allowedActions: ['full_file_rewrite', 'layout_change', 'style_change', 'structure_change'],
            forbiddenActions: []
        };
    }

    // Score repair vs feature
    const repairScore = REPAIR_KEYWORDS.filter(k => lower.includes(k)).length;
    const featureScore = FEATURE_KEYWORDS.filter(k => lower.includes(k)).length;

    if (repairScore > featureScore) {
        return {
            mode: 'REPAIR_MODE',
            confidence: Math.min(0.95, 0.5 + repairScore * 0.15),
            reasoning: `Detected repair intent: ${REPAIR_KEYWORDS.filter(k => lower.includes(k)).join(', ')}`,
            constraints: [
                'PRESERVE existing CSS/styling',
                'PRESERVE layout structure',
                'PRESERVE design tokens',
                'ONLY modify logic/functionality within targeted scope'
            ],
            allowedActions: [
                'fix_javascript_logic',
                'correct_html_structure',
                'fix_broken_links',
                'repair_event_handlers',
                'fix_data_binding'
            ],
            forbiddenActions: [
                'change_colors',
                'change_fonts',
                'change_spacing',
                'rewrite_full_files',
                'change_layout',
                'add_new_components'
            ]
        };
    }

    return {
        mode: 'FEATURE_MODE',
        confidence: Math.min(0.95, 0.5 + featureScore * 0.15),
        reasoning: `Detected feature intent: ${FEATURE_KEYWORDS.filter(k => lower.includes(k)).join(', ')}`,
        constraints: [
            'INHERIT design tokens from current state',
            'MAINTAIN visual consistency',
            'PRESERVE existing functionality'
        ],
        allowedActions: [
            'add_new_component',
            'extend_functionality',
            'add_new_section',
            'enhance_existing_feature'
        ],
        forbiddenActions: [
            'remove_existing_features',
            'change_core_layout',
            'override_design_tokens'
        ]
    };
}

// --- DOM Structure Analysis ---

export function computeDomStructureHash(html: string): string {
    // Extract tag structure (ignores attributes and content)
    const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    const tags: string[] = [];
    let match;
    while ((match = tagPattern.exec(html)) !== null) {
        tags.push(match[1].toLowerCase());
    }

    // Create a simple hash of the structure
    const structureString = tags.join('|');
    let hash = 0;
    for (let i = 0; i < structureString.length; i++) {
        const char = structureString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

export function extractStyleSignature(html: string): string {
    // Extract key style patterns
    const patterns: string[] = [];

    // Primary colors
    const colorMatches = html.match(/(?:color|background|border):\s*([#\w]+)/gi) || [];
    const uniqueColors = [...new Set(colorMatches.map(c => c.toLowerCase()))];
    patterns.push(`colors:${uniqueColors.length}`);

    // Font references
    const fontMatches = html.match(/font-family:\s*([^;]+)/gi) || [];
    patterns.push(`fonts:${fontMatches.length}`);

    // Layout patterns
    const flexCount = (html.match(/display:\s*flex/gi) || []).length;
    const gridCount = (html.match(/display:\s*grid/gi) || []).length;
    patterns.push(`flex:${flexCount},grid:${gridCount}`);

    return patterns.join('|');
}

export function computeDomDriftPercent(oldHash: string, newHash: string): number {
    if (oldHash === newHash) return 0;
    if (!oldHash || !newHash) return 100;

    // Simple similarity based on hash prefix matching
    let matchingChars = 0;
    const minLen = Math.min(oldHash.length, newHash.length);
    for (let i = 0; i < minLen; i++) {
        if (oldHash[i] === newHash[i]) matchingChars++;
    }

    const similarity = matchingChars / Math.max(oldHash.length, newHash.length);
    return Math.round((1 - similarity) * 100);
}

// --- Vibe Guard ---

export interface VibeGuardResult {
    approved: boolean;
    reason: string;
    domDrift: number;
    styleDrift: boolean;
    recommendations: string[];
}

export function runVibeGuard(
    mode: ExecutionMode,
    currentState: CurrentState,
    newHtml: string,
    newCss?: string
): VibeGuardResult {
    const newDomHash = computeDomStructureHash(newHtml);
    const domDrift = computeDomDriftPercent(currentState.domStructureHash, newDomHash);

    const newStyleSig = extractStyleSignature(newHtml + (newCss || ''));
    const styleDrift = newStyleSig !== currentState.styleSignature;

    // REPAIR_MODE: Very strict - block if DOM changes > 10%
    if (mode === 'REPAIR_MODE') {
        if (domDrift > 10) {
            return {
                approved: false,
                reason: `DOM structure changed ${domDrift}% during REPAIR_MODE (max 10% allowed)`,
                domDrift,
                styleDrift,
                recommendations: [
                    'The repair should only fix logic, not restructure the page',
                    'Consider using more targeted fixes',
                    'If a redesign is needed, user should explicitly request it'
                ]
            };
        }
        if (styleDrift) {
            return {
                approved: false,
                reason: 'Style changes detected during REPAIR_MODE (styling changes forbidden)',
                domDrift,
                styleDrift,
                recommendations: [
                    'Do not modify colors, fonts, or spacing during repairs',
                    'Preserve the existing visual design'
                ]
            };
        }
    }

    // FEATURE_MODE: More lenient - allow up to 30% drift
    if (mode === 'FEATURE_MODE') {
        if (domDrift > 30) {
            return {
                approved: false,
                reason: `DOM structure changed ${domDrift}% during FEATURE_MODE (max 30% allowed)`,
                domDrift,
                styleDrift,
                recommendations: [
                    'New features should extend, not replace the existing structure',
                    'Preserve the core layout while adding new components'
                ]
            };
        }
    }

    // FULL_REGEN: No constraints
    return {
        approved: true,
        reason: mode === 'FULL_REGEN'
            ? 'Full regeneration mode - all changes allowed'
            : `Changes within acceptable limits for ${mode}`,
        domDrift,
        styleDrift,
        recommendations: []
    };
}

// --- Context File Management ---

const getElectron = () => (window as any).electron;

export async function loadProjectManifest(projectId: string): Promise<ProjectManifest | null> {
    const electron = getElectron();
    if (!electron?.fs) return null;

    try {
        const userData = await electron.getAppPath?.();
        if (!userData) return null;

        const manifestPath = `${userData}/projects/${projectId}/.ai-context/manifest.json`;
        const raw = await electron.fs.read(manifestPath);
        return JSON.parse(raw) as ProjectManifest;
    } catch {
        return null;
    }
}

export async function saveProjectManifest(projectId: string, manifest: ProjectManifest): Promise<void> {
    const electron = getElectron();
    if (!electron?.fs) return;

    try {
        const userData = await electron.getAppPath?.();
        if (!userData) return;

        const contextDir = `${userData}/projects/${projectId}/.ai-context`;
        const manifestPath = `${contextDir}/manifest.json`;

        manifest.lastUpdatedAt = Date.now();
        await electron.fs.write(manifestPath, JSON.stringify(manifest, null, 2));
    } catch (e) {
        console.error('[CLIE] Failed to save manifest:', e);
    }
}

export async function loadCurrentState(projectId: string): Promise<CurrentState | null> {
    const electron = getElectron();
    if (!electron?.fs) return null;

    try {
        const userData = await electron.getAppPath?.();
        if (!userData) return null;

        const statePath = `${userData}/projects/${projectId}/.ai-context/current-state.json`;
        const raw = await electron.fs.read(statePath);
        return JSON.parse(raw) as CurrentState;
    } catch {
        return null;
    }
}

export async function saveCurrentState(projectId: string, html: string, css: string): Promise<void> {
    const electron = getElectron();
    if (!electron?.fs) return;

    try {
        const userData = await electron.getAppPath?.();
        if (!userData) return;

        const state: CurrentState = {
            htmlSnapshot: html.substring(0, 5000), // Store first 5KB
            cssSnapshot: css.substring(0, 2000),
            domStructureHash: computeDomStructureHash(html),
            styleSignature: extractStyleSignature(html + css),
            lastModifiedAt: Date.now()
        };

        const statePath = `${userData}/projects/${projectId}/.ai-context/current-state.json`;
        await electron.fs.write(statePath, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('[CLIE] Failed to save state:', e);
    }
}

export async function loadInteractionHistory(projectId: string): Promise<InteractionHistory> {
    const electron = getElectron();
    if (!electron?.fs) {
        return { records: [], totalInteractions: 0, lastInteractionAt: 0 };
    }

    try {
        const userData = await electron.getAppPath?.();
        if (!userData) return { records: [], totalInteractions: 0, lastInteractionAt: 0 };

        const historyPath = `${userData}/projects/${projectId}/.ai-context/interaction-history.json`;
        const raw = await electron.fs.read(historyPath);
        return JSON.parse(raw) as InteractionHistory;
    } catch {
        return { records: [], totalInteractions: 0, lastInteractionAt: 0 };
    }
}

export async function recordInteraction(
    projectId: string,
    prompt: string,
    mode: ExecutionMode,
    whatChanged: string,
    contextPreserved: boolean,
    domDrift: number
): Promise<void> {
    const electron = getElectron();
    if (!electron?.fs) return;

    try {
        const history = await loadInteractionHistory(projectId);

        const record: InteractionRecord = {
            id: Date.now().toString(36),
            timestamp: Date.now(),
            userPrompt: prompt.substring(0, 500),
            mode,
            whatChanged,
            contextPreserved,
            domDriftPercent: domDrift
        };

        history.records.push(record);
        // Keep only last 50 interactions
        if (history.records.length > 50) {
            history.records = history.records.slice(-50);
        }
        history.totalInteractions++;
        history.lastInteractionAt = Date.now();

        const userData = await electron.getAppPath?.();
        if (!userData) return;

        const historyPath = `${userData}/projects/${projectId}/.ai-context/interaction-history.json`;
        await electron.fs.write(historyPath, JSON.stringify(history, null, 2));
    } catch (e) {
        console.error('[CLIE] Failed to record interaction:', e);
    }
}

// --- Prompt Enhancement ---

export function enhancePromptWithContext(
    userPrompt: string,
    manifest: ProjectManifest | null,
    intentAnalysis: IntentAnalysis
): string {
    const lines: string[] = [];

    lines.push('## CONTEXT-LOCKED EXECUTION');
    lines.push('');

    if (manifest) {
        lines.push('### Project Soul');
        lines.push(`**Original Request:** "${manifest.originalPrompt}"`);
        lines.push(`**Core Intent:** ${manifest.coreIntent}`);
        if (manifest.nonNegotiableFeatures.length > 0) {
            lines.push(`**Non-Negotiables:** ${manifest.nonNegotiableFeatures.join(', ')}`);
        }
        lines.push('');
    }

    lines.push(`### Execution Mode: ${intentAnalysis.mode}`);
    lines.push(`**Confidence:** ${Math.round(intentAnalysis.confidence * 100)}%`);
    lines.push(`**Reasoning:** ${intentAnalysis.reasoning}`);
    lines.push('');

    if (intentAnalysis.constraints.length > 0) {
        lines.push('### CONSTRAINTS (Must Follow)');
        intentAnalysis.constraints.forEach(c => lines.push(`- ${c}`));
        lines.push('');
    }

    if (intentAnalysis.forbiddenActions.length > 0) {
        lines.push('### FORBIDDEN ACTIONS');
        intentAnalysis.forbiddenActions.forEach(a => lines.push(`- ❌ ${a}`));
        lines.push('');
    }

    if (intentAnalysis.allowedActions.length > 0) {
        lines.push('### ALLOWED ACTIONS');
        intentAnalysis.allowedActions.forEach(a => lines.push(`- ✅ ${a}`));
        lines.push('');
    }

    lines.push('### User Request');
    lines.push(userPrompt);

    return lines.join('\n');
}

// --- Initialize Context for New Project ---

export async function initializeProjectContext(project: Project, originalPrompt: string): Promise<void> {
    const manifest: ProjectManifest = {
        projectId: project.id,
        projectName: project.name,
        originalPrompt: originalPrompt,
        coreIntent: extractCoreIntent(originalPrompt),
        nonNegotiableFeatures: extractNonNegotiables(originalPrompt),
        designTokens: {},
        createdAt: Date.now(),
        lastUpdatedAt: Date.now()
    };

    await saveProjectManifest(project.id, manifest);
}

function extractCoreIntent(prompt: string): string {
    // Extract the main action/object from the prompt
    const lower = prompt.toLowerCase();

    if (lower.includes('dashboard')) return 'Dashboard Application';
    if (lower.includes('landing') || lower.includes('page')) return 'Landing Page';
    if (lower.includes('game')) return 'Interactive Game';
    if (lower.includes('calculator')) return 'Calculator Widget';
    if (lower.includes('shop') || lower.includes('store') || lower.includes('ecommerce')) return 'E-commerce Store';
    if (lower.includes('portfolio')) return 'Portfolio Website';
    if (lower.includes('server') || lower.includes('bare metal')) return 'Server Configuration Tool';
    if (lower.includes('builder')) return 'Builder/Configurator Tool';
    if (lower.includes('pricing')) return 'Pricing Page';

    // Default: first 50 chars
    return prompt.substring(0, 50);
}

function extractNonNegotiables(prompt: string): string[] {
    const features: string[] = [];
    const lower = prompt.toLowerCase();

    // Extract key features mentioned in the prompt
    if (lower.includes('pricing')) features.push('Pricing display');
    if (lower.includes('builder')) features.push('Interactive builder');
    if (lower.includes('real-time') || lower.includes('realtime')) features.push('Real-time updates');
    if (lower.includes('calculator')) features.push('Calculator functionality');
    if (lower.includes('form')) features.push('Form handling');
    if (lower.includes('responsive')) features.push('Responsive design');
    if (lower.includes('animation')) features.push('Animations');

    return features;
}

// --- Snapshot / Revert System (Time Travel) ---

export interface SnapshotMetadata {
    id: string;
    timestamp: number;
    description: string;
    files: Record<string, string>; // Filename -> Content
}

export async function saveSnapshot(projectId: string, description: string, files: Record<string, string>): Promise<void> {
    const electron = getElectron();
    if (!electron?.fs) return;

    try {
        const userData = await electron.getAppPath?.();
        if (!userData) return;

        const snapshotDir = `${userData}/projects/${projectId}/.ai-context/snapshots`;
        const manifestPath = `${snapshotDir}/manifest.json`;

        // Ensure dir exists (mock check, write will handle if nested usually, but good practice)
        // Here we rely on write creating parent dirs or we assume standard structure.

        // Load existing snapshots
        let snapshots: SnapshotMetadata[] = [];
        try {
            const raw = await electron.fs.read(manifestPath);
            snapshots = JSON.parse(raw);
        } catch {
            // No manifest yet
        }

        // Create new snapshot
        const id = Date.now().toString();
        const snapshot: SnapshotMetadata = {
            id,
            timestamp: Date.now(),
            description,
            files
        };

        // Add to list and enforce limit (15)
        snapshots.unshift(snapshot);
        if (snapshots.length > 15) {
            snapshots = snapshots.slice(0, 15);
            // Ideally we would delete old snapshot file content here if stored separately,
            // but if we store everything in manifest for single-file apps it's fine.
            // For scalability, let's store content in manifest for now as typically it's just index.html.
        }

        await electron.fs.write(manifestPath, JSON.stringify(snapshots, null, 2));
    } catch (e) {
        console.error('[CLIE] Failed to save snapshot:', e);
    }
}

export async function restoreSnapshot(projectId: string, snapshotId?: string): Promise<Record<string, string> | null> {
    const electron = getElectron();
    if (!electron?.fs) return null;

    try {
        const userData = await electron.getAppPath?.();
        if (!userData) return null;

        const snapshotDir = `${userData}/projects/${projectId}/.ai-context/snapshots`;
        const manifestPath = `${snapshotDir}/manifest.json`;

        const raw = await electron.fs.read(manifestPath);
        const snapshots: SnapshotMetadata[] = JSON.parse(raw);

        if (snapshots.length === 0) return null;

        // Restore specific or latest
        const metadata = snapshotId ? snapshots.find(s => s.id === snapshotId) : snapshots[0];

        return metadata ? metadata.files : null;
    } catch {
        return null;
    }
}

export async function getSnapshots(projectId: string): Promise<SnapshotMetadata[]> {
    const electron = getElectron();
    if (!electron?.fs) return [];

    try {
        const userData = await electron.getAppPath?.();
        if (!userData) return [];

        const snapshotDir = `${userData}/projects/${projectId}/.ai-context/snapshots`;
        const manifestPath = `${snapshotDir}/manifest.json`;

        const raw = await electron.fs.read(manifestPath);
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export async function undoLastChange(projectId: string): Promise<Record<string, string> | null> {
    const electron = getElectron();
    if (!electron?.fs) return null;

    try {
        const userData = await electron.getAppPath?.();
        if (!userData) return null;

        const snapshotDir = `${userData}/projects/${projectId}/.ai-context/snapshots`;
        const manifestPath = `${snapshotDir}/manifest.json`;

        // 1. Load Snapshots
        let snapshots: SnapshotMetadata[] = [];
        try {
            const raw = await electron.fs.read(manifestPath);
            snapshots = JSON.parse(raw);
        } catch {
            return null;
        }

        if (snapshots.length === 0) return null;

        // 2. Get latest snapshot to restore
        const latest = snapshots[0];

        // 3. Restore Files
        const projectDir = `${userData}/projects/${projectId}`;
        for (const [filename, content] of Object.entries(latest.files)) {
            await electron.fs.write(`${projectDir}/${filename}`, content);
        }

        // 4. Remove this snapshot from the stack
        snapshots.shift();
        await electron.fs.write(manifestPath, JSON.stringify(snapshots, null, 2));

        // 5. Update Current State Context
        if (latest.files['index.html']) {
            await saveCurrentState(projectId, latest.files['index.html'], latest.files['style.css'] || '');
        }

        return latest.files;
    } catch (e) {
        console.error('[CLIE] Undo failed:', e);
        return null;
    }
}

export const CLIE_VERSION = '1.2.0';
