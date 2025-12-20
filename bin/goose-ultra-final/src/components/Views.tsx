import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useOrchestrator, getEnabledTabs } from '../orchestrator';
import { Icons } from '../constants';
import { GlobalMode, OrchestratorState, TabId } from '../types';
import { MockComputerDriver, MockBrowserDriver, applyPlanToExistingHtml, generateMockPlan, generateMockFiles, ensureProjectOnDisk, writeLastActiveProjectId, extractMemoriesFromText, addMemory, saveProjectContext, extractProjectContext } from '../services/automationService';
import { initializeProjectContext, undoLastChange } from '../services/ContextEngine';
import { generateTaskPlan, validatePlan, parseUserIntent } from '../services/viAgentPlanner';
import { ViAgentExecutor } from '../services/viAgentExecutor';
import { ViControlView } from './ViControlView';
import { ContextFeedPanel } from './LayoutComponents';
import Editor, { useMonaco } from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';

// --- Shared: Tab Navigation ---
export const TabNav = () => {
    const { state, dispatch } = useOrchestrator();
    const enabledTabs = getEnabledTabs(state.state);

    return (
        <div className="flex justify-center py-2 shrink-0 z-10">
            <div className="flex items-center gap-1 glass-float rounded-full p-1 px-1.5 backdrop-blur-md">
                {Object.values(TabId).map(tab => {
                    const isEnabled = enabledTabs.includes(tab);
                    const isActive = state.activeTab === tab;
                    const isPreviewReady = tab === TabId.Preview && state.state === OrchestratorState.PreviewReady && !isActive;

                    return (
                        <button
                            key={tab}
                            disabled={!isEnabled}
                            onClick={() => dispatch({ type: 'SET_TAB', tab })}
                            className={`
                  relative px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-full transition-all duration-300
                  ${isActive ? 'text-black bg-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'text-zinc-500 hover:text-zinc-300'}
                  ${isPreviewReady ? 'animate-pulse ring-1 ring-primary text-primary shadow-[0_0_15px_rgba(52,211,153,0.5)]' : ''}
                  ${!isEnabled ? 'opacity-30 cursor-not-allowed' : ''}
              `}
                        >
                            {tab}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// --- View: Start (God Mode) ---

// Framework auto-suggestion logic based on project keywords
const detectBestFramework = (description: string): string | null => {
    const lower = description.toLowerCase();

    // Explicit framework mentions
    if (lower.includes('react')) return 'React';
    if (lower.includes('vue')) return 'Vue';
    if (lower.includes('svelte')) return 'Svelte';
    if (lower.includes('next')) return 'Next.js';
    if (lower.includes('astro')) return 'Astro';
    if (lower.includes('flutter')) return 'Flutter';

    // Dashboard / Analytics / Data-heavy -> React
    if (/dashboard|analytics|admin|portal|platform|saas|web app|tool|calculator|manager|tracker|visualization|metrics|crm|erp/.test(lower)) {
        return 'React';
    }
    // E-commerce / Store -> Next.js (SSR for SEO)
    if (/e-?commerce|store|shop|marketplace|product catalog|checkout/.test(lower)) {
        return 'Next.js';
    }
    // Blog / Content site -> Astro (content-focused, fast)
    if (/blog|content|magazine|news site|documentation|docs|wiki/.test(lower)) {
        return 'Astro';
    }
    // Real-time / Chat / Collaboration -> Vue (reactive)
    if (/real-?time|chat|collaboration|messaging|live|websocket/.test(lower)) {
        return 'Vue';
    }
    // Animation-heavy / Interactive -> Svelte (lightweight, performant)
    if (/animation|interactive|game|canvas|3d|threejs|physics|particles/.test(lower)) {
        return 'Svelte';
    }
    // Mobile / PWA -> Flutter or React (common choice)
    if (/mobile|pwa|app|ios|android|responsive/.test(lower)) {
        return 'React';
    }
    // Portfolio / Landing -> Tailwind CSS + Vanilla
    if (/portfolio|landing|showcase|personal site|resume/.test(lower)) {
        return 'Tailwind CSS';
    }
    // Form-heavy / CRUD -> Vue or React
    if (/form|crud|survey|questionnaire|wizard/.test(lower)) {
        return 'Vue';
    }

    return null; // No strong suggestion
};

export const StartView = () => {
    const { state, dispatch } = useOrchestrator();
    const [prompt, setPrompt] = useState('');
    const [suggestedFramework, setSuggestedFramework] = useState<string | null>(null);
    const [suggestedSkills, setSuggestedSkills] = useState<Array<{ id: string; name: string; icon: string }>>([]);
    const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // PATCH: Ensure textarea is focusable and not stuck in disabled state
    useEffect(() => {
        // Small delay to ensure DOM is ready
        const focusTimer = setTimeout(() => {
            if (textareaRef.current && state.globalMode !== GlobalMode.Chat) {
                textareaRef.current.disabled = false;
                textareaRef.current.focus();
            }
        }, 100);
        return () => clearTimeout(focusTimer);
    }, [state.globalMode]);    // Auto-detect framework and match skills based on prompt with debounce
    useEffect(() => {
        if (suggestionTimeoutRef.current) {
            clearTimeout(suggestionTimeoutRef.current);
        }

        if (prompt.trim().length < 10) {
            setSuggestedFramework(null);
            setSuggestedSkills([]);
            return;
        }

        suggestionTimeoutRef.current = setTimeout(async () => {
            const detected = detectBestFramework(prompt);
            // Only suggest if user hasn't manually selected one
            if (!state.preferredFramework && detected) {
                setSuggestedFramework(detected);
            } else {
                setSuggestedFramework(null);
            }

            // Match skills from catalog based on prompt keywords
            try {
                const { skillsService } = await import('../services/skillsService');
                await skillsService.ensureLoaded();
                const catalog = skillsService.getCatalog();
                const installed = skillsService.getInstalled();
                const installedIds = new Set(installed.map(s => s.id));

                const promptLower = prompt.toLowerCase();
                const matchedSkills = catalog
                    .filter(skill => {
                        if (installedIds.has(skill.id)) return false; // Don't suggest already installed
                        const nameMatch = skill.name.toLowerCase().split(/\s+/).some(word => promptLower.includes(word));
                        const descMatch = skill.description.toLowerCase().split(/\s+/).some(word =>
                            word.length > 4 && promptLower.includes(word)
                        );
                        const categoryMatch = skill.category.toLowerCase().split(/\s+/).some(word => promptLower.includes(word));
                        return nameMatch || descMatch || categoryMatch;
                    })
                    .slice(0, 3) // Max 3 suggestions
                    .map(s => ({ id: s.id, name: s.name, icon: s.icon || 'Terminal' }));

                setSuggestedSkills(matchedSkills);
            } catch (e) {
                console.warn('Failed to load skills for suggestions', e);
            }
        }, 500); // 500ms debounce

        return () => {
            if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
        };
    }, [prompt, state.preferredFramework]);

    const handleStart = (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        // 1. Initialize Project Data
        const createdAt = Date.now();
        // FIX: Reuse active project ID if available to preserve context/uploads on retry
        const id = state.activeProject?.id || ((globalThis.crypto && 'randomUUID' in globalThis.crypto)
            ? (globalThis.crypto as any).randomUUID()
            : createdAt.toString());

        const name = state.activeProject?.name || "Project " + createdAt.toString().slice(-4);

        // Preserve original prompt if refining
        const combinedPrompt = state.activeProject?.originalPrompt
            ? `${state.activeProject.originalPrompt}\n\n[Refinement]: ${prompt}`
            : prompt;

        // 2. Update Global State - LAYER 5: Store originalPrompt
        dispatch({ type: 'CREATE_PROJECT', id, createdAt, name, originalPrompt: combinedPrompt });
        void ensureProjectOnDisk({ id, name, slug: name.toLowerCase().replace(/\s+/g, '-'), createdAt, description: 'New Vibe Project', originalPrompt: combinedPrompt });
        // CLIE: Initialize Context Soul (Manifest)
        void initializeProjectContext({ id, name, slug: name.toLowerCase().replace(/\s+/g, '-'), createdAt, description: 'New Vibe Project' }, combinedPrompt);
        void writeLastActiveProjectId(id);
        dispatch({ type: 'ADD_LOG', log: { id: Date.now().toString(), timestamp: Date.now(), type: 'user', message: prompt } });

        // 3. Immediate Transition (Fixes "Submit twice" UX issue)
        // We transition to Planning immediately so the user sees progress.
        dispatch({ type: 'TRANSITION', to: OrchestratorState.Planning });
        dispatch({ type: 'SET_TAB', tab: TabId.Plan });
        dispatch({ type: 'UPDATE_PLAN', plan: "# Generating Blueprint...\n\n*Analyzing requirements and forging architecture...*" });

        if ((window as any).electron) {
            let systemPrompt = "You are Goose Ultra, an advanced AI coding engine. Your goal is to generate a comprehensive implementation plan (Blueprint) for the requested application. DO NOT write the full code yet. Just outline the architecture, files, and logic. Return markdown. START WITH [PLAN].";
            if (state.preferredFramework) {
                systemPrompt += `\n\n[USER PREFERENCE]: The user has explicitly requested to use the "${state.preferredFramework}" framework. You MUST prioritize this framework, along with its standard ecosystem (e.g. if React, use typical React libs; if Tailwind, use utility classes).`;
            }

            // LAYER 2: Generate unique session ID for this stream
            const planSessionId = `plan-${Date.now()}`;
            dispatch({ type: 'START_STREAM_SESSION', sessionId: planSessionId });

            (window as any).electron.startChat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: combinedPrompt }
            ], state.chatSettings.activeModel);

            let streamBuffer = '';
            (window as any).electron.onChatChunk((chunk: string) => {
                // LAYER 2: Check if session was cancelled
                if (state.cancelledSessionIds?.includes(planSessionId)) {
                    console.log(`[Layer 2] Ignoring chunk for cancelled session: ${planSessionId}`);
                    return;
                }
                // Buffer chunks for visibility
                streamBuffer += chunk;
                dispatch({ type: 'UPDATE_STREAMING_CODE', code: streamBuffer });
            });

            (window as any).electron.onChatComplete((response: string) => {
                // LAYER 2: Check if session was cancelled
                if (state.cancelledSessionIds?.includes(planSessionId)) {
                    console.log(`[Layer 2] Ignoring complete for cancelled session: ${planSessionId}`);
                    dispatch({ type: 'END_STREAM_SESSION', sessionId: planSessionId });
                    (window as any).electron.removeChatListeners();
                    return;
                }
                dispatch({ type: 'UPDATE_PLAN', plan: response });
                dispatch({ type: 'UPDATE_STREAMING_CODE', code: null });
                // LAYER 1: Transition to PlanReady - user MUST approve before building
                dispatch({ type: 'TRANSITION', to: OrchestratorState.PlanReady });
                dispatch({ type: 'END_STREAM_SESSION', sessionId: planSessionId });
                (window as any).electron.removeChatListeners();
            });

            (window as any).electron.onChatError((error: string) => {
                dispatch({ type: 'ADD_LOG', log: { id: Date.now().toString(), timestamp: Date.now(), type: 'error', message: error } });
                // Set a structured error message with clear guidance
                const errorPlan = `# ⚠️ Generation Failed

**Error:** ${error.includes('AUTHENTICATION') ? 'Authentication required' : 'Connection or API error'}

---

## What happened?
The AI service could not generate your blueprint. This is usually due to:
- Missing API credentials
- Network connectivity issues  
- Service temporarily unavailable

## How to fix:
1. **Check Authentication:** Run option 5 in the launcher to login
2. **Try Again:** Click "Reject" then submit your idea again
3. **Check Logs:** View the terminal tab for detailed error info

---

*Your idea: "${prompt.substring(0, 100)}..."*`;

                dispatch({ type: 'UPDATE_PLAN', plan: errorPlan });
                dispatch({ type: 'TRANSITION', to: OrchestratorState.ProjectSelected });

                if (error.includes('AUTHENTICATION')) {
                    alert("Authentication Missing.\nPlease run 'OpenQode > Option 4' to login.");
                }
                (window as any).electron.removeChatListeners();
            });
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden bg-[#030304]">
            {/* Dynamic Aurora Background */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] bg-gradient-to-tr from-primary/10 via-purple-500/10 to-blue-500/10 rounded-full blur-[100px] animate-pulse-slow pointer-events-none mix-blend-screen" />

            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="z-10 w-full max-w-3xl flex flex-col items-center">
                <div className="mb-8 flex items-center gap-2 glass-float rounded-full p-1 border border-white/10 bg-black/30">
                    <button
                        onClick={() => dispatch({ type: 'SET_MODE', mode: GlobalMode.Build })}
                        className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${state.globalMode === GlobalMode.Build ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.25)]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Build
                    </button>
                    <button
                        onClick={() => dispatch({ type: 'SET_MODE', mode: GlobalMode.GameDev })}
                        className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${state.globalMode === GlobalMode.GameDev ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 text-white shadow-[0_0_25px_rgba(168,85,247,0.6)] animate-pulse' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                    >
                        🎮 Game Dev
                    </button>
                    <button
                        onClick={() => dispatch({ type: 'SET_MODE', mode: GlobalMode.OfficeAssist })}
                        className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${state.globalMode === GlobalMode.OfficeAssist ? 'bg-gradient-to-r from-blue-500 to-orange-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                    >
                        📊 Office Assist
                    </button>
                    <button
                        onClick={() => dispatch({ type: 'SET_MODE', mode: GlobalMode.Chat })}
                        className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${state.globalMode === GlobalMode.Chat ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.25)]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Chat
                    </button>
                    <button
                        onClick={() => dispatch({ type: 'SET_MODE', mode: GlobalMode.UXDesigner })}
                        className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${state.globalMode === GlobalMode.UXDesigner ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white shadow-[0_0_25px_rgba(244,63,94,0.4)]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                    >
                        🎨 UX Designer
                    </button>
                    <button
                        onClick={() => dispatch({ type: 'SET_MODE', mode: GlobalMode.Opus })}
                        className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${state.globalMode === GlobalMode.Opus ? 'bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-700 text-white shadow-[0_0_25px_rgba(202,138,4,0.4)]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                    >
                        👑 Opus Mode
                    </button>
                </div>
                {/* Dynamic Hero Section based on Mode */}
                <div className="mb-10 flex flex-col items-center gap-4 text-center">
                    {state.globalMode === GlobalMode.GameDev ? (
                        <>
                            <motion.div
                                animate={{ rotateY: [0, 360] }}
                                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                className="w-20 h-20 bg-gradient-to-br from-purple-500 via-cyan-400 to-pink-500 rounded-lg border-4 border-white/30 flex items-center justify-center shadow-[0_0_60px_rgba(168,85,247,0.5)] relative"
                                style={{ transformStyle: 'preserve-3d' }}
                            >
                                <span className="text-4xl">🎮</span>
                                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 rounded-lg" />
                            </motion.div>
                            <div>
                                <h1 className="text-5xl font-display font-bold tracking-tight mb-2">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 animate-pulse">
                                        Level Up Your Game
                                    </span>
                                </h1>
                                <p className="text-lg font-medium">
                                    <span className="text-purple-300">Create epic </span>
                                    <span className="text-cyan-300">3D worlds</span>
                                    <span className="text-pink-300"> • Browser games</span>
                                    <span className="text-yellow-300"> • Adventures</span>
                                </p>
                            </div>
                        </>
                    ) : state.globalMode === GlobalMode.UXDesigner ? (
                        <>
                            <motion.div
                                initial={{ rotate: 0 }}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                className="w-20 h-20 bg-gradient-to-tr from-pink-500 to-amber-500 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(244,63,94,0.3)] relative overflow-hidden"
                            >
                                <div className="absolute inset-2 border-2 border-white/20 rounded-2xl border-dashed animate-pulse" />
                                <Icons.Pencil className="w-10 h-10 text-white" />
                            </motion.div>
                            <div>
                                <h1 className="text-5xl font-display font-bold tracking-tight mb-2">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-amber-400">
                                        Atelier Design Studio
                                    </span>
                                </h1>
                                <p className="text-zinc-500 text-lg font-light">Craft high-fidelity prototypes & design systems.</p>
                            </div>
                        </>
                    ) : state.globalMode === GlobalMode.Opus ? (
                        <>
                            <motion.div
                                animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="w-24 h-24 bg-gradient-to-b from-yellow-500 via-amber-600 to-yellow-800 rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(202,138,4,0.4)] relative"
                            >
                                <Icons.Zap className="w-12 h-12 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                                <div className="absolute inset-0 border-4 border-white/5 rounded-full animate-ping" />
                            </motion.div>
                            <div>
                                <h1 className="text-5xl font-display font-bold tracking-tight mb-2">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 via-amber-500 to-yellow-600">
                                        Opus Cognitive Bridge
                                    </span>
                                </h1>
                                <p className="text-zinc-500 text-lg font-light uppercase tracking-[0.2em] animate-pulse">Force Pro-Tier Reasoning Layer</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-black rounded-2xl border border-white/10 flex items-center justify-center shadow-[0_0_40px_rgba(52,211,153,0.15)] relative group">
                                <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                {state.state === OrchestratorState.Planning ? <Icons.RefreshCw className="w-8 h-8 text-white animate-spin" /> : <Icons.Sparkles className="w-8 h-8 text-white relative z-10" />}
                            </div>
                            <div>
                                <h1 className="text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 tracking-tight mb-2">
                                    What will you create?
                                </h1>
                                <p className="text-zinc-500 text-lg font-light">Describe it. Goose Ultra builds it.</p>
                            </div>
                        </>
                    )}
                </div>

                {(state.globalMode === GlobalMode.Build || state.globalMode === GlobalMode.GameDev || state.globalMode === GlobalMode.OfficeAssist || state.globalMode === GlobalMode.UXDesigner || state.globalMode === GlobalMode.Opus) ? (
                    <form onSubmit={handleStart} className="w-full relative group perspective-1000">
                        <div className={`absolute -inset-1 ${state.globalMode === GlobalMode.GameDev ? 'bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500' :
                            state.globalMode === GlobalMode.OfficeAssist ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-orange-400' :
                                state.globalMode === GlobalMode.UXDesigner ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500' :
                                    state.globalMode === GlobalMode.Opus ? 'bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-800' :
                                        'bg-gradient-to-r from-primary via-purple-500 to-blue-500'
                            } rounded-3xl opacity-20 group-hover:opacity-40 blur-lg transition-opacity duration-500`} />
                        <div className="relative bg-[#0A0A0B] rounded-2xl p-2 border border-white/10 shadow-2xl transition-transform duration-300 group-hover:scale-[1.01]">
                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleStart(e); }}
                                placeholder={
                                    state.globalMode === GlobalMode.GameDev ? "Create a 3D survival game on a mysterious island..." :
                                        state.globalMode === GlobalMode.OfficeAssist ? "Create a presentation about Tbilisi, Georgia with 5 slides..." :
                                            state.globalMode === GlobalMode.UXDesigner ? "Design a dark-mode Fintech dashboard with glassmorphism..." :
                                                state.globalMode === GlobalMode.Opus ? "Enter complex architectural challenge... [Initializing OMEGA-PRO]" :
                                                    "I want a dashboard for..."
                                }
                                className="w-full bg-transparent border-none text-xl text-white placeholder-zinc-700 px-6 py-4 focus:ring-0 resize-none h-32 leading-relaxed font-sans"
                                autoFocus
                                disabled={state.state === OrchestratorState.Planning}
                            />
                            <div className="flex justify-between items-center px-4 pb-3">
                                <div className="flex gap-2 items-center flex-wrap">
                                    {/* Framework Selector - Enhanced */}
                                    <div className="relative group/framework">
                                        <div className="flex items-center gap-1 bg-gradient-to-r from-zinc-800/80 to-zinc-900/80 rounded-xl border border-white/10 p-1 backdrop-blur-sm">
                                            <button
                                                type="button"
                                                className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                                            >
                                                <Icons.Code className="w-3.5 h-3.5 text-purple-400" />
                                                <span className="text-zinc-300">{state.preferredFramework || "Auto"}</span>
                                                <Icons.ChevronDown className="w-3 h-3 opacity-40" />
                                            </button>
                                            {/* Quick Pick */}
                                            <div className="flex items-center gap-0.5 border-l border-white/10 pl-1">
                                                {['React', 'Vue', 'Next.js', 'Tailwind CSS'].map(fw => (
                                                    <button
                                                        key={fw}
                                                        type="button"
                                                        onClick={() => {
                                                            dispatch({ type: 'SET_PREFERRED_FRAMEWORK', framework: fw });
                                                            setSuggestedFramework(null);
                                                        }}
                                                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${state.preferredFramework === fw
                                                            ? 'bg-primary/30 text-primary'
                                                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                                                            }`}
                                                    >
                                                        {fw.replace('.js', '').replace(' CSS', '')}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <select
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                            value={state.preferredFramework || ""}
                                            onChange={(e) => {
                                                dispatch({ type: 'SET_PREFERRED_FRAMEWORK', framework: e.target.value || null });
                                                setSuggestedFramework(null); // Clear suggestion when user manually selects
                                            }}
                                        >
                                            <option value="">Auto-Detect Framework</option>
                                            <optgroup label="Frontend Core">
                                                <option value="React">React</option>
                                                <option value="Vue">Vue</option>
                                                <option value="Svelte">Svelte</option>
                                                <option value="Solid">Solid</option>
                                                <option value="Qwik">Qwik</option>
                                            </optgroup>
                                            <optgroup label="Full Stack">
                                                <option value="Next.js">Next.js</option>
                                                <option value="Nuxt">Nuxt</option>
                                                <option value="SvelteKit">SvelteKit</option>
                                                <option value="Astro">Astro</option>
                                            </optgroup>
                                            <optgroup label="Mobile & Styles">
                                                <option value="Flutter">Flutter</option>
                                                <option value="Tailwind CSS">Tailwind CSS</option>
                                                <option value="MUI">MUI (Material UI)</option>
                                                <option value="Ant Design">Ant Design</option>
                                            </optgroup>
                                        </select>
                                    </div>

                                    {/* Smart Framework Suggestion */}
                                    {suggestedFramework && !state.preferredFramework && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                dispatch({ type: 'SET_PREFERRED_FRAMEWORK', framework: suggestedFramework });
                                                setSuggestedFramework(null);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold bg-gradient-to-r from-primary/20 to-emerald-500/20 text-primary border border-primary/40 rounded-full hover:from-primary/30 hover:to-emerald-500/30 transition-all shadow-[0_0_15px_rgba(52,211,153,0.15)] group"
                                        >
                                            <Icons.Sparkles className="w-3 h-3 animate-pulse" />
                                            <span>AI: {suggestedFramework}</span>
                                            <span className="text-[9px] opacity-60 group-hover:opacity-100">← use</span>
                                        </button>
                                    )}
                                    {/* Current selection badge */}
                                    {state.preferredFramework && (
                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[10px] text-purple-300 animate-fade-in">
                                            <Icons.CheckCircle className="w-3 h-3" />
                                            <span>{state.preferredFramework}</span>
                                            <button
                                                type="button"
                                                onClick={() => dispatch({ type: 'SET_PREFERRED_FRAMEWORK', framework: null })}
                                                className="ml-0.5 text-purple-400 hover:text-white"
                                            >
                                                <Icons.X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button disabled={state.state === OrchestratorState.Planning} type="submit" className="bg-white text-black px-6 py-2 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center gap-2 disabled:opacity-50">
                                    {state.state === OrchestratorState.Planning ? 'Thinking...' : <>Generate <Icons.ArrowRight className="w-4 h-4" /></>}
                                </button>
                            </div>

                            {/* Skill Suggestions Row */}
                            {suggestedSkills.length > 0 && (
                                <div className="px-4 pb-3 flex items-center gap-2 flex-wrap animate-fade-in">
                                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Recommended Skills:</span>
                                    {suggestedSkills.map(skill => {
                                        const IconComponent = (Icons as any)[skill.icon] || Icons.Terminal;
                                        return (
                                            <button
                                                key={skill.id}
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        const { skillsService } = await import('../services/skillsService');
                                                        await skillsService.installSkill(skill.id);
                                                        setSuggestedSkills(prev => prev.filter(s => s.id !== skill.id));
                                                    } catch (e) {
                                                        console.error('Failed to install skill', e);
                                                    }
                                                }}
                                                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full hover:bg-blue-500/20 transition-all group"
                                            >
                                                <IconComponent className="w-3 h-3" />
                                                <span>{skill.name}</span>
                                                <span className="text-[9px] opacity-60 group-hover:opacity-100">+ install</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </form>
                ) : (
                    <div className="w-full max-w-3xl animate-fade-in">
                        <h2 className="font-display font-bold text-2xl text-white mb-8">Select Active Persona</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { id: 'assistant', name: 'Goose Assistant', icon: Icons.Sparkles, desc: 'General help & coding' },
                                { id: 'therapist', name: 'The Therapist', icon: Icons.MessageSquare, desc: 'Emotional support & reflection' },
                                { id: 'business', name: 'Business Coach', icon: Icons.Layout, desc: 'Goals, strategy & ROI' },
                                { id: 'it', name: 'IT Expert', icon: Icons.Terminal, desc: 'Systems, debugging & commands' },
                                { id: 'designer', name: 'UX Designer', icon: Icons.Pencil, desc: 'UI/UX patterns & style' },
                                ...state.personas.map(p => ({
                                    id: p.id,
                                    name: p.name,
                                    icon: Icons.Settings,
                                    desc: p.subtitle
                                }))
                            ].map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        if (['assistant', 'therapist', 'business', 'it', 'designer'].includes(p.id)) {
                                            dispatch({ type: 'SET_CHAT_PERSONA', persona: p.id as any });
                                            dispatch({ type: 'SET_ACTIVE_PERSONA', personaId: null });
                                        } else {
                                            dispatch({ type: 'SET_CHAT_PERSONA', persona: 'custom' });
                                            dispatch({ type: 'SET_ACTIVE_PERSONA', personaId: p.id });
                                        }
                                    }}
                                    className={`p-4 rounded-2xl border text-left transition-all duration-300 group ${(state.chatPersona === p.id || state.activePersonaId === p.id)
                                        ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(52,211,153,0.15)] ring-1 ring-primary'
                                        : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-800 hover:border-white/20'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full mb-3 flex items-center justify-center transition-colors ${(state.chatPersona === p.id || state.activePersonaId === p.id) ? 'bg-primary text-black' : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-300'}`}>
                                        <p.icon className="w-5 h-5" />
                                    </div>
                                    <div className={`font-bold text-sm mb-1 ${(state.chatPersona === p.id || state.activePersonaId === p.id) ? 'text-white' : 'text-zinc-300'}`}>{p.name}</div>
                                    <div className="text-xs text-zinc-500 leading-snug">{p.desc}</div>
                                </button>
                            ))}

                            {/* Create New Persona Card */}
                            <button
                                onClick={() => dispatch({ type: 'OPEN_PERSONA_MODAL' })}
                                className="p-4 rounded-2xl border border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 group flex flex-col items-center justify-center text-center gap-2 h-full min-h-[140px]"
                            >
                                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform group-hover:border-primary/50">
                                    <Icons.Plus className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-zinc-400 group-hover:text-white transition-colors">Create Persona</div>
                                    <div className="text-[10px] text-zinc-600 group-hover:text-primary/70 transition-colors">Define new personality</div>
                                </div>
                            </button>
                        </div>
                        <div className="mt-8 text-center">
                            <p className="text-zinc-500 text-xs">Selected persona will define the tone and expertise of the chat.</p>
                        </div>
                    </div>
                )}

                {state.globalMode !== GlobalMode.Chat && (
                    <div className="mt-10 flex flex-wrap justify-center gap-3">
                        {['Marketing Site', 'SaaS Dashboard', 'Calculator Widget', 'Landing Page'].map(t => (
                            <button key={t} onClick={() => { setPrompt(`Build a ${t}`); }} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-zinc-400 hover:text-white text-xs font-medium transition-all hover:-translate-y-0.5">
                                {t}
                            </button>
                        ))}
                    </div>
                )}
            </motion.div>
        </div>
    );
};

// --- View: Plan ---
export const PlanView = () => {
    const { state, dispatch } = useOrchestrator();
    const [isEditing, setIsEditing] = useState(false);
    const [draftPlan, setDraftPlan] = useState('');
    const [activeTechIndex, setActiveTechIndex] = useState(0);

    // Check if we should show Context Feed instead of Blueprint
    const CONSULTING_PERSONAS = ['therapist', 'business', 'assistant', 'custom'];
    const showContextFeed = state.globalMode === GlobalMode.Chat && CONSULTING_PERSONAS.includes(state.chatPersona);

    // If in Chat mode with consulting persona, show Context Feed
    if (showContextFeed) {
        return <ContextFeedPanel />;
    }

    const planSignature = useMemo(() => {
        const normalized = (draftPlan || state.plan || '').trim();
        let hash = 5381;
        for (let i = 0; i < normalized.length; i++) {
            hash = ((hash << 5) + hash) ^ normalized.charCodeAt(i);
        }
        return `plan_${(hash >>> 0).toString(16)}`;
    }, [draftPlan, state.plan]);
    const planResolved = !!state.resolvedPlans?.[planSignature];

    const techTags = useMemo(() => {
        const content = [draftPlan || '', state.plan || '', state.streamingCode || '', Object.keys(state.files).join(' ')].join('\n');
        const lower = content.toLowerCase();
        const tags: string[] = [];
        const add = (label: string, test: boolean) => { if (test && !tags.includes(label)) tags.push(label); };
        add('HTML', lower.includes('<!doctype') || lower.includes('<html') || lower.includes('index.html'));
        add('CSS', lower.includes('style.css') || lower.includes('<style') || lower.includes('css'));
        add('JavaScript', lower.includes('javascript') || lower.includes('script.js') || lower.includes('<script'));
        add('TypeScript', lower.includes('typescript') || lower.includes('.ts') || lower.includes('.tsx'));
        add('Tailwind', lower.includes('tailwind') || lower.includes('cdn.tailwindcss.com'));
        add('React', lower.includes('react') || lower.includes('reactdom'));
        add('Vue', lower.includes('vue'));
        add('Svelte', lower.includes('svelte'));
        add('Bootstrap', lower.includes('bootstrap'));
        return (tags.length ? tags : ['HTML', 'CSS', 'JavaScript']).slice(0, 10);
    }, [draftPlan, state.plan, state.streamingCode, state.files]);

    useEffect(() => {
        if (state.state !== OrchestratorState.Building) return;
        const id = setInterval(() => {
            setActiveTechIndex((i) => (techTags.length ? (i + 1) % techTags.length : 0));
        }, 900);
        return () => clearInterval(id);
    }, [state.state, techTags.length]);

    const handleApprove = async () => {
        // LAYER 1 GUARD: Only allow building from PlanReady state (or legacy states for backwards compat)
        const allowedStates = [OrchestratorState.PlanReady, OrchestratorState.PreviewReady, OrchestratorState.Editing];
        if (!allowedStates.includes(state.state)) {
            console.warn(`[Layer 1 Guard] Build blocked: state is ${state.state}, expected PlanReady`);
            return;
        }

        const sessionId = Date.now().toString();
        dispatch({ type: 'TRANSITION', to: OrchestratorState.Building });
        dispatch({ type: 'START_BUILD_SESSION', sessionId });

        dispatch({
            type: 'ADD_LOG',
            log: { id: Date.now().toString(), timestamp: Date.now(), type: 'system', message: "Initializing build sequence... compiling instructions..." }
        });

        try {
            // 1. Compile Plan -> Code (retain current HTML for modifications)
            // @ts-ignore
            const { compilePlanToCode } = await import('../services/automationService');
            const planText = draftPlan || state.plan || '';
            const projectId = state.activeProject?.id || 'latest';
            const isModification = state.state === OrchestratorState.PreviewReady || state.state === OrchestratorState.Editing;
            const currentHtml = state.files['index.html'] || '';

            const rawCode = isModification && currentHtml
                ? await applyPlanToExistingHtml(planText, currentHtml, (chunk: string) => dispatch({ type: 'UPDATE_STREAMING_CODE', code: chunk }), 0, projectId)
                : await compilePlanToCode(planText, (chunk: string) => dispatch({ type: 'UPDATE_STREAMING_CODE', code: chunk }), projectId);

            dispatch({
                type: 'ADD_LOG',
                log: { id: Date.now().toString(), timestamp: Date.now(), type: 'system', message: "Code synthesized. Writing artifacts..." }
            });

            // 2. Extract and Write
            const rawFiles = await generateMockFiles(`projects/${projectId}`, rawCode);
            // Type assertion to handle the mixed return type safely
            const { _qaFailed, _qaReport, ...fileData } = rawFiles as any;

            // Log QA failure if present (metadata usage)
            if (_qaFailed) {
                console.warn("Build failed QA check", _qaReport);
            }

            dispatch({ type: 'UPDATE_FILES', files: fileData });

            dispatch({ type: 'END_BUILD_SESSION', sessionId });

            // M2: Extract and save memories from the plan after successful build
            try {
                const planMemories = await extractMemoriesFromText(projectId, planText, sessionId);
                for (const mem of planMemories) {
                    await addMemory(projectId, mem);
                }
                console.log(`[Memory] Extracted ${planMemories.length} memories from build`);

                // L3: Save project context with fingerprints
                const context = extractProjectContext(rawCode, projectId);
                await saveProjectContext(projectId, context);
                console.log('[Memory] Saved project context/fingerprints');
            } catch (memErr) {
                console.warn('[Memory] Extraction failed (non-blocking):', memErr);
            }

            // Instant transition for better vibe
            dispatch({ type: 'TRANSITION', to: OrchestratorState.PreviewReady });
            dispatch({ type: 'SET_TAB', tab: TabId.Preview });
            dispatch({ type: 'RESOLVE_PLAN', signature: planSignature, resolution: 'approved' });
        } catch (e: any) {
            console.error("PlanView build failed:", e);
            dispatch({ type: 'END_BUILD_SESSION', sessionId });
            dispatch({ type: 'UPDATE_STREAMING_CODE', code: null });

            // Revert to Planning so user can fix
            dispatch({ type: 'TRANSITION', to: OrchestratorState.Planning });
            dispatch({ type: 'SET_TAB', tab: TabId.Plan });

            const errorMessage = e?.message || "Build Failed due to invalid output.";
            dispatch({
                type: 'ADD_LOG',
                log: {
                    id: Date.now().toString(),
                    timestamp: Date.now(),
                    type: 'error',
                    message: `Build Failed: ${errorMessage}\n\nThe model returned text instead of code. Please try again.`
                }
            });
        }
    };

    const handleEditToggle = () => {
        if (!isEditing) {
            setDraftPlan(state.plan || '');
        }
        setIsEditing(!isEditing);
    };

    const handleReject = () => {
        dispatch({ type: 'ADD_LOG', log: { id: Date.now().toString(), timestamp: Date.now(), type: 'user', message: 'Plan Rejected. Please propose a different approach.' } });
        dispatch({ type: 'UPDATE_PLAN', plan: '' });
        dispatch({ type: 'TRANSITION', to: OrchestratorState.ProjectSelected });
        setIsEditing(false);
        setDraftPlan('');
    };

    if (state.state === OrchestratorState.Building) {
        const lines = (state.streamingCode || '').split('\n').length;
        const chars = (state.streamingCode || '').length;

        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] animate-fade-in p-4 gap-4 overflow-hidden relative">
                {/* P0-1: Live Streaming Code Panel */}
                <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scanline" />
                </div>

                <div className="flex items-center justify-between w-full max-w-5xl z-10 p-2">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-3 h-3 bg-primary rounded-full animate-ping absolute top-0 left-0" />
                            <div className="w-3 h-3 bg-primary rounded-full relative z-10" />
                        </div>
                        <div>
                            <h2 className="text-xl font-display font-bold text-white tracking-widest uppercase">Forging Application</h2>
                            <p className="text-zinc-500 text-xs font-mono">Stream Active &middot; {lines} Lines &middot; {chars} Chars</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {techTags.map(t => (
                            <span key={t} className="text-[10px] font-mono border border-primary/30 text-primary px-2 py-0.5 rounded-full bg-primary/10">{t}</span>
                        ))}
                    </div>
                </div>

                <div className="w-full max-w-6xl flex-1 bg-black/50 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
                    <Editor
                        height="100%"
                        defaultLanguage="html"
                        theme="vs-dark"
                        value={state.streamingCode || '<!-- Initializing Stream... -->'}
                        options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 12,
                            fontFamily: 'JetBrains Mono, Menlo, monospace',
                            scrollBeyondLastLine: false,
                            smoothScrolling: true,
                            cursorBlinking: 'smooth'
                        }}
                    />
                    <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono text-primary flex items-center gap-2">
                        <Icons.Sparkles className="w-3 h-3 animate-pulse" />
                        Receiving Packets...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-8 max-w-6xl mx-auto w-full animate-fade-in flex flex-col h-full overflow-hidden">
            {/* Responsive header - stacks on smaller screens */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 shrink-0 gap-4">
                <div className="min-w-0 flex-shrink">
                    {state.streamingCode && state.streamingCode.length > 0 ? (
                        <div className="flex items-center gap-4">
                            {/* Animated Logo */}
                            <div className="relative w-12 h-12 flex-shrink-0">
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary to-cyan-400 rounded-xl animate-spin-slow" style={{ animation: 'spin 3s linear infinite' }} />
                                <div className="absolute inset-0.5 bg-black rounded-xl flex items-center justify-center">
                                    <Icons.Sparkles className="w-6 h-6 text-primary" />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-2xl font-display font-bold text-white">Forging Blueprint</h2>
                                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-full flex items-center gap-1 animate-pulse">
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                        LIVE
                                    </span>
                                </div>
                                <div className="flex gap-3 text-xs mt-1">
                                    <span className="text-zinc-500">{state.streamingCode.split('\n').length} lines</span>
                                    <span className="text-zinc-500">{state.streamingCode.length} chars</span>
                                    <span className="text-emerald-400">~{Math.ceil(state.streamingCode.length / 4)} tokens</span>
                                </div>
                            </div>
                        </div>
                    ) : state.plan?.includes('Generating') || state.state === OrchestratorState.Planning ? (
                        /* WOW Visual Loading State */
                        <div className="flex items-center gap-4 lg:gap-6">
                            <div className="relative flex-shrink-0">
                                {/* Multi-ring spinner */}
                                <div className="w-12 h-12 lg:w-16 lg:h-16 relative">
                                    <div className="absolute inset-0 border-2 border-transparent border-t-purple-500 rounded-full animate-spin" />
                                    <div className="absolute inset-1 border-2 border-transparent border-t-blue-500 rounded-full animate-spin-reverse" style={{ animationDuration: '1.5s' }} />
                                    <div className="absolute inset-2 border-2 border-transparent border-t-emerald-500 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Icons.Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-white animate-pulse" />
                                    </div>
                                </div>
                                {/* Glow effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 rounded-full blur-xl opacity-30 animate-pulse" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl lg:text-2xl font-display font-bold text-white flex items-center gap-2 lg:gap-3 flex-wrap">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-emerald-400">
                                        Analyzing Requirements
                                    </span>
                                    <span className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </span>
                                </h2>
                                <p className="text-zinc-500 text-xs lg:text-sm mt-1 flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-2">
                                    <span>AI is crafting your architecture</span>
                                    <span className="text-primary font-mono text-xs">PATIENCE_LEVEL: HIGH</span>
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-display font-bold text-white">Blueprint</h2>
                            <p className="text-zinc-500 text-sm mt-1">Architecture & Implementation Plan</p>
                        </>
                    )}
                </div>
                {/* Buttons - wrap to new line on smaller screens */}
                <div className="flex flex-wrap gap-2 lg:gap-3 flex-shrink-0">
                    {/* LAYER 1: Approve button only enabled in PlanReady state */}
                    {state.plan && !planResolved && state.state === OrchestratorState.PlanReady && (
                        <button onClick={handleApprove} className="px-4 py-2 bg-primary text-black font-bold rounded-lg hover:bg-emerald-400 text-sm shadow-[0_0_20px_rgba(52,211,153,0.3)] transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
                            <Icons.Play className="w-4 h-4" /> Approve & Build
                        </button>
                    )}
                    {/* Show disabled button during Planning state */}
                    {state.plan && !planResolved && state.state === OrchestratorState.Planning && (
                        <button disabled className="px-4 py-2 bg-zinc-700 text-zinc-400 font-bold rounded-lg text-sm cursor-not-allowed flex items-center gap-2 opacity-50">
                            <Icons.RefreshCw className="w-4 h-4 animate-spin" /> Generating...
                        </button>
                    )}
                    {state.plan && !planResolved && (
                        <button onClick={handleEditToggle} className="px-4 py-2 bg-blue-500/20 text-blue-200 font-bold rounded-lg hover:bg-blue-500/30 text-sm border border-blue-500/20 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
                            <Icons.MessageSquare className="w-4 h-4" /> {isEditing ? 'Close' : 'Edit'}
                        </button>
                    )}
                    {state.plan && !planResolved && (
                        <button onClick={handleReject} className="px-4 py-2 bg-rose-500/15 text-rose-200 font-bold rounded-lg hover:bg-rose-500/25 text-sm border border-rose-500/20 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
                            <Icons.X className="w-4 h-4" /> Reject
                        </button>
                    )}
                    {state.plan && planResolved && (
                        <button onClick={() => dispatch({ type: 'SET_TAB', tab: TabId.Preview })} className="px-4 py-2 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 text-sm shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
                            <Icons.Monitor className="w-4 h-4" /> Preview
                        </button>
                    )}
                    {state.plan && planResolved && (
                        <button onClick={handleApprove} className="px-4 py-2 bg-primary/20 text-primary font-bold rounded-lg hover:bg-primary/25 text-sm border border-primary/20 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
                            <Icons.RefreshCw className="w-4 h-4" /> Rebuild
                        </button>
                    )}
                    {(state.state === OrchestratorState.PreviewReady || Object.keys(state.files).length > 0) && (
                        <button onClick={() => dispatch({ type: 'SET_TAB', tab: TabId.Preview })} className="px-4 py-2 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 text-sm shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
                            <Icons.Monitor className="w-4 h-4" /> Load Preview
                        </button>
                    )}

                    {/* LAYER 3: Emergency / Abort buttons */}
                    {(state.state === OrchestratorState.Planning) && (
                        <button
                            onClick={() => {
                                if (confirm('Are you sure you want to cancel the CURRENT AI action?')) {
                                    dispatch({ type: 'SET_STATE', state: OrchestratorState.ProjectSelected });
                                    dispatch({ type: 'ADD_LOG', log: { id: Date.now().toString(), timestamp: Date.now(), type: 'system', message: 'User aborted current AI task.' } });
                                }
                            }}
                            className="px-4 py-2 bg-amber-500/20 text-amber-200 font-bold rounded-lg hover:bg-amber-500/30 text-sm border border-amber-500/20 flex items-center gap-2"
                        >
                            <Icons.ZapOff className="w-4 h-4" /> Cancel AI
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (confirm('CRITICAL: Reset engine to idle state? All current state will be lost.')) {
                                dispatch({ type: 'SET_STATE', state: OrchestratorState.ProjectSelected });
                                dispatch({ type: 'SET_TAB', tab: TabId.Start });
                            }
                        }}
                        className="px-4 py-2 bg-red-500/20 text-red-200 font-bold rounded-lg hover:bg-red-500/30 text-sm border border-red-500/20 flex items-center gap-2"
                    >
                        <Icons.ShieldAlert className="w-4 h-4" /> Emergency Stop
                    </button>
                </div>
            </div>

            <div className="flex-1 glass p-8 rounded-3xl border border-white/10 text-zinc-300 shadow-2xl overflow-y-auto">
                {state.plan ? (
                    isEditing ? (
                        <textarea
                            value={draftPlan}
                            onChange={(e) => setDraftPlan(e.target.value)}
                            className="w-full h-full min-h-[420px] bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary/40"
                        />
                    ) : (
                        <div className="prose prose-invert prose-headings:text-white prose-headings:font-display prose-a:text-primary max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.streamingCode || state.plan}</ReactMarkdown>
                        </div>
                    )
                ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-50">
                        <Icons.FileCode className="w-12 h-12 text-zinc-600 mb-4" />
                        <p>No plan generated yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- View: Preview (Arc-Style) ---
export const PreviewView = () => {
    const { state, dispatch } = useOrchestrator();
    const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [iframeKey, setIframeKey] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Circle Memory Feature - Overlay-based selection
    const [circleMemoryMode, setCircleMemoryMode] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [memoryNote, setMemoryNote] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Handle mouse down to start selection
    const handleSelectionStart = (e: React.MouseEvent) => {
        if (!circleMemoryMode || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setSelectionStart({ x, y });
        setSelectionBox({ x, y, width: 0, height: 0 });
        setIsDrawing(true);
    };

    // Handle mouse move to update selection
    const handleSelectionMove = (e: React.MouseEvent) => {
        if (!isDrawing || !selectionStart || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const x = Math.min(selectionStart.x, currentX);
        const y = Math.min(selectionStart.y, currentY);
        const width = Math.abs(currentX - selectionStart.x);
        const height = Math.abs(currentY - selectionStart.y);

        setSelectionBox({ x, y, width, height });
    };

    // Handle mouse up to finish selection
    const handleSelectionEnd = () => {
        if (!isDrawing) return;
        setIsDrawing(false);

        if (selectionBox && selectionBox.width > 20 && selectionBox.height > 20) {
            setShowSaveDialog(true);
        } else {
            setSelectionBox(null);
        }
    };

    // Save selection to memory
    const handleSaveToMemory = async () => {
        if (!selectionBox || !state.activeProject?.id) return;
        const { addMemory } = await import('../services/automationService');

        const description = memoryNote.trim() || `UI Region at (${Math.round(selectionBox.x)}, ${Math.round(selectionBox.y)})`;

        await addMemory(state.activeProject.id, {
            scope: 'project',
            key: `Visual Selection: ${description.substring(0, 50)}`,
            value: `User selected area: ${description}. Position: x=${Math.round(selectionBox.x)}, y=${Math.round(selectionBox.y)}, size: ${Math.round(selectionBox.width)}x${Math.round(selectionBox.height)}px. This area should be preserved or referenced in future modifications.`,
            type: 'preference',
            confidence: 0.95,
            source: 'circle-memory'
        });

        setSelectionBox(null);
        setShowSaveDialog(false);
        setMemoryNote('');
        setCircleMemoryMode(false);
    };

    // Cancel selection
    const handleCancelSelection = () => {
        setSelectionBox(null);
        setShowSaveDialog(false);
        setMemoryNote('');
    };

    // AI Visual Health Check Feature
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [healthReport, setHealthReport] = useState<{
        status: 'healthy' | 'issues' | 'broken';
        issues: string[];
        repairPlan: string;
    } | null>(null);
    const [showRepairDialog, setShowRepairDialog] = useState(false);
    const [hasPreviewIssues, setHasPreviewIssues] = useState(false);

    // Auto-detect potential issues when preview content changes
    useEffect(() => {
        const htmlContent = state.files['index.html'] || '';
        if (!htmlContent) {
            setHasPreviewIssues(false);
            return;
        }

        // Quick heuristic checks for common issues - make these sensitive
        const topContent = htmlContent.substring(0, 2000);
        const suspectIssues = [
            // CDATA visible
            htmlContent.includes('<![CDATA[') || htmlContent.includes(']]>'),
            // Missing structure
            !htmlContent.toLowerCase().includes('<!doctype') && !htmlContent.toLowerCase().includes('<html'),
            // Raw tag fragments visible (like "head>" or "body>" without < before)
            /[^<]head>/i.test(topContent) || /[^<]body>/i.test(topContent) || /[^<]html>/i.test(topContent),
            // Excessive class= patterns in visible text
            (htmlContent.match(/[^<]class=["']/gi) || []).length > 10,
            // Very short content (likely broken)
            htmlContent.length < 300 && htmlContent.includes('<'),
            // Starts with > instead of <
            topContent.includes('>') && !topContent.includes('<'),
            // Double-escaped
            htmlContent.includes('&lt;') || htmlContent.includes('&gt;'),
        ];

        setHasPreviewIssues(suspectIssues.some(Boolean));
    }, [state.files, state.activeProject]);

    const runAIHealthCheck = async () => {
        if (!state.files['index.html']) {
            alert('No preview content to analyze');
            return;
        }

        setIsAnalyzing(true);
        setHealthReport(null);

        try {
            const htmlContent = state.files['index.html'] || '';
            const cssContent = state.files['style.css'] || '';

            // Analyze content for common issues
            const issues: string[] = [];

            // Check 1: CDATA sections visible (sign of improper parsing)
            if (htmlContent.includes('<![CDATA[') || htmlContent.includes(']]>')) {
                issues.push('CDATA sections present - script content not properly wrapped');
            }

            // Check 2: Multiple consecutive class= or style= references (raw code visible)
            const classAttrCount = (htmlContent.match(/class=["']/gi) || []).length;
            const visibleClassPatterns = (htmlContent.match(/[^<]class=["'][^"']+["']/gi) || []).length;
            if (visibleClassPatterns > 10) {
                issues.push('Excessive class attributes detected as visible text - HTML not rendering');
            }

            // Check 3: HTML tag-like content visible as text (e.g., "head>" or "div class=")
            const brokenTagPatterns = [
                /[^<]head>/i,       // head> without < before it
                /[^<]body>/i,       // body> without <
                /[^<]html>/i,       // html> without <
                /[^<]script>/i,     // script> without <
                /[^<]style>/i,      // style> without <
                /\sclass=["']/,     // class=" not inside a tag context
            ];
            for (const pattern of brokenTagPatterns) {
                if (pattern.test(htmlContent.substring(0, 3000))) {
                    issues.push('Raw HTML tag fragments visible as text - rendering broken');
                    break;
                }
            }

            // Check 4: Missing DOCTYPE or HTML structure
            if (!htmlContent.toLowerCase().includes('<!doctype') && !htmlContent.toLowerCase().includes('<html')) {
                issues.push('Missing proper HTML document structure');
            }

            // Check 5: CSS not loading (no styles inline or external)
            if (!htmlContent.includes('<style') && !htmlContent.includes('.css') && !cssContent) {
                issues.push('No CSS styling detected - page may appear unstyled');
            }

            // Check 6: Double-escaped HTML entities
            if (htmlContent.includes('&lt;') || htmlContent.includes('&gt;')) {
                issues.push('HTML entities visible - content may be double-escaped');
            }

            // Check 7: Very long lines without whitespace (minified mess visible as text)
            const lines = htmlContent.split('\n');
            const veryLongVisibleLines = lines.filter(l => l.length > 500 && !l.includes('base64') && l.includes('class=')).length;
            if (veryLongVisibleLines > 3) {
                issues.push('Minified code visible as text instead of rendered HTML');
            }

            // Check 8: Corrupted structure - Opening without closing in wrong places
            const topContent = htmlContent.substring(0, 500);
            if (topContent.includes('>') && !topContent.includes('<')) {
                issues.push('Malformed HTML - closing angle brackets without opening tags at start');
            }

            // Determine status - be more aggressive marking as broken
            const status = issues.length === 0 ? 'healthy' : issues.length <= 2 ? 'issues' : 'broken';

            // Generate repair plan using AI if issues found
            let repairPlan = '';
            if (issues.length > 0 && (window as any).electron) {
                // LAYER 5: Context Preservation - Include original prompt
                const originalPrompt = state.activeProject?.originalPrompt || '';
                const projectDescription = state.activeProject?.description || 'web application';

                const repairPrompt = `You are fixing a broken web application preview. 

## CRITICAL: ORIGINAL USER REQUEST (MUST be implemented exactly)
"${originalPrompt || projectDescription}"

This is what the user originally asked for. Your repair plan MUST result in THIS exact concept being built correctly. Do NOT change the concept, idea, or design intent.

## DETECTED ISSUES:
${issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

## CURRENT BROKEN HTML (first 2000 chars):
${htmlContent.substring(0, 2000)}

## YOUR TASK:
Generate a REPAIR PLAN in markdown format that:
1. Explains what went WRONG with the rendering (briefly)
2. Lists the SPECIFIC technical fixes needed to make the HTML render correctly
3. MAINTAINS the original user request: "${originalPrompt || projectDescription}"
4. Describes what the WORKING version should look like (matching the original request)

IMPORTANT: The repaired version must implement the EXACT same concept as the original request. Do NOT change the idea, just fix the broken HTML/CSS.

Start with "# 🔧 Repair Plan" and be concise.`;

                await new Promise<void>((resolve) => {
                    let buffer = '';
                    (window as any).electron.startChat([
                        { role: 'system', content: 'You are a UI debugging expert. Generate a clear, actionable repair plan that PRESERVES the original user request. Never change the concept, only fix technical issues.' },
                        { role: 'user', content: repairPrompt }
                    ], 'qwen-coder-plus');

                    (window as any).electron.onChatChunk((chunk: string) => {
                        buffer += chunk;
                    });

                    (window as any).electron.onChatComplete((response: string) => {
                        repairPlan = response;
                        (window as any).electron.removeChatListeners();
                        resolve();
                    });

                    (window as any).electron.onChatError(() => {
                        repairPlan = `# 🔧 Suggested Fixes\n\n${issues.map(i => `- Fix: ${i}`).join('\n')}\n\nPlease rebuild with clearer instructions.`;
                        (window as any).electron.removeChatListeners();
                        resolve();
                    });
                });
            }

            setHealthReport({ status, issues, repairPlan });
            if (issues.length > 0) {
                setShowRepairDialog(true);
            }
        } catch (e) {
            console.error('Health check failed', e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const applyRepairPlan = () => {
        if (!healthReport?.repairPlan) return;

        // Navigate to Plan view with the repair plan
        dispatch({ type: 'UPDATE_PLAN', plan: healthReport.repairPlan });
        // LAYER 1 FIX: Transition to PlanReady so "Approve & Build" button appears
        dispatch({ type: 'TRANSITION', to: OrchestratorState.PlanReady });
        dispatch({ type: 'SET_TAB', tab: TabId.Plan });
        setShowRepairDialog(false);
        setHealthReport(null);
    };

    // Safety timeout for loading state
    useEffect(() => {
        if (isLoading) {
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = setTimeout(() => {
                setIsLoading(false);
            }, 2500); // Force stop loading after 2.5s
        }
        return () => {
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        };
    }, [isLoading, iframeKey]);

    useEffect(() => {
        if ((window as any).electron) {
            const projectId = state.activeProject?.id || 'latest';
            // Async fetch port
            (window as any).electron.getServerPort().then((port: number) => {
                const fullPath = `http://127.0.0.1:${port}/projects/${projectId}/index.html`;
                console.log("[Preview] Using Server:", fullPath);
                setPreviewUrl(fullPath);
                setTimeout(() => setIframeKey(k => k + 1), 100);
            }).catch((err: any) => {
                console.error("Failed to get server port", err);
                // Fallback
                setPreviewUrl(`http://127.0.0.1:45678/projects/${projectId}/index.html`);
            });
        }
    }, [state.activeProject, state.files]);

    const handleRefresh = () => {
        setIsLoading(true);
        setIframeKey(prev => prev + 1);
    };

    const handleUndo = async () => {
        if (!state.activeProject?.id) return;
        if (confirm('Are you sure you want to revert the last change? This will roll back to the previous snapshot.')) {
            setIsLoading(true);
            const restoredFiles = await undoLastChange(state.activeProject.id);
            if (restoredFiles) {
                // Refresh preview
                setIframeKey(k => k + 1);
                // Sync internal state
                dispatch({ type: 'UPDATE_FILES', files: restoredFiles });
                dispatch({ type: 'ADD_LOG', log: { id: Date.now().toString(), timestamp: Date.now(), type: 'system', message: 'Reverted to previous snapshot.' } });
            } else {
                alert('No previous snapshots available to revert to.');
            }
            setIsLoading(false);
        }
    };

    return (
        <div className={`flex-1 flex flex-col bg-[#050505] overflow-hidden ${state.previewMaxMode ? 'p-0' : 'p-4 pt-0'}`}>
            {/* Floating Chrome */}
            <div className={`h-14 bg-zinc-900/80 backdrop-blur-xl border border-white/10 flex items-center px-4 gap-4 shrink-0 shadow-2xl z-20 ${state.previewMaxMode ? 'rounded-none mb-0' : 'rounded-2xl mb-4'}`}>
                <div className="flex gap-2">
                    <button className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors" title="Back"><Icons.ArrowLeft className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors" title="Forward"><Icons.ArrowRight className="w-4 h-4" /></button>
                    <button onClick={handleRefresh} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors" title="Reload"><Icons.RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /></button>
                    <button onClick={handleUndo} className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-red-400 transition-colors" title="Undo Last Change (Max 15)"><Icons.RotateCcw className="w-3.5 h-3.5" /></button>
                </div>

                <div className="flex-1 max-w-xl mx-auto bg-black/50 border border-white/5 rounded-full h-9 flex items-center justify-center px-4 text-xs text-zinc-400 select-none group focus-within:border-primary/50 transition-all hover:bg-black/80 hover:border-white/10 shadow-inner overflow-hidden text-ellipsis whitespace-nowrap">
                    <Icons.ShieldAlert className="w-3 h-3 mr-2 text-emerald-500 shrink-0" />
                    <span className="text-zinc-300 font-medium truncate">{previewUrl || 'about:blank'}</span>
                </div>

                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                    <button onClick={() => setDevice('desktop')} className={`p-1.5 rounded-lg transition-all ${device === 'desktop' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}><Icons.Monitor className="w-4 h-4" /></button>
                    <button onClick={() => setDevice('tablet')} className={`p-1.5 rounded-lg transition-all ${device === 'tablet' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}><Icons.Tablet className="w-4 h-4" /></button>
                    <button onClick={() => setDevice('mobile')} className={`p-1.5 rounded-lg transition-all ${device === 'mobile' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}><Icons.Smartphone className="w-4 h-4" /></button>
                </div>

                {/* Circle Memory Toggle */}
                <button
                    onClick={() => {
                        setCircleMemoryMode(!circleMemoryMode);
                        handleCancelSelection();
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${circleMemoryMode ? 'bg-purple-500 text-white border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-zinc-200'}`}
                    title="Circle to Memory: Draw a box to save to context"
                >
                    <Icons.Sparkles className={`w-3.5 h-3.5 ${circleMemoryMode ? 'animate-pulse' : ''}`} />
                    {circleMemoryMode ? 'Drawing...' : 'Circle Memory'}
                </button>

                {/* AI Health Check Button */}
                <button
                    onClick={runAIHealthCheck}
                    disabled={isAnalyzing}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${isAnalyzing
                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/30 cursor-wait'
                        : healthReport?.status === 'broken'
                            ? 'bg-red-500/20 text-red-300 border-red-500/30 animate-pulse'
                            : healthReport?.status === 'issues'
                                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 animate-pulse'
                                : healthReport?.status === 'healthy'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : hasPreviewIssues && !healthReport
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                                        : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-zinc-200'
                        }`}
                    title={hasPreviewIssues ? "⚠️ Potential issues detected - Click to analyze" : "AI Health Check: Scan for visual issues"}
                >
                    {isAnalyzing ? (
                        <>
                            <Icons.RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Scanning...
                        </>
                    ) : healthReport?.status === 'broken' ? (
                        <>
                            <Icons.AlertTriangle className="w-3.5 h-3.5" />
                            Issues Found
                        </>
                    ) : healthReport?.status === 'healthy' ? (
                        <>
                            <Icons.CheckCircle className="w-3.5 h-3.5" />
                            Healthy
                        </>
                    ) : hasPreviewIssues ? (
                        <>
                            <Icons.AlertTriangle className="w-3.5 h-3.5" />
                            Check Health
                        </>
                    ) : (
                        <>
                            <Icons.ShieldAlert className="w-3.5 h-3.5" />
                            Health Check
                        </>
                    )}
                </button>

                <button
                    onClick={() => dispatch({ type: 'SET_PREVIEW_MAX_MODE', enabled: !state.previewMaxMode })}
                    className={`ml-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${state.previewMaxMode ? 'bg-primary text-black border-primary/40 hover:bg-emerald-400' : 'bg-white/5 text-zinc-200 border-white/10 hover:bg-white/10'}`}
                    title="Toggle Max Mode"
                >
                    {state.previewMaxMode ? 'Exit Max' : 'Max Mode'}
                </button>
            </div>

            {/* Iframe Container with Selection Overlay */}
            <div
                ref={containerRef}
                className="flex-1 flex items-center justify-center overflow-hidden relative bg-zinc-900/50"
                onMouseDown={handleSelectionStart}
                onMouseMove={handleSelectionMove}
                onMouseUp={handleSelectionEnd}
                onMouseLeave={handleSelectionEnd}
            >
                <motion.div
                    layout
                    className={`bg-[#0B0B0C] transition-all duration-500 ease-out shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative ${device === 'mobile' ? 'w-[375px] h-[667px] rounded-[2.5rem] border-[8px] border-zinc-900' :
                        device === 'tablet' ? 'w-[768px] h-[1024px] rounded-[1.5rem] border-[8px] border-zinc-900' :
                            `${state.previewMaxMode ? 'w-full h-full rounded-none border-0' : 'w-full h-full rounded-2xl border border-white/10'}`
                        }`}
                >
                    {previewUrl ? (
                        <>
                            <iframe
                                ref={iframeRef}
                                key={iframeKey}
                                src={`${previewUrl}?t=${iframeKey}`}
                                title="App Preview"
                                className={`w-full h-full border-none bg-[#0B0B0C] ${circleMemoryMode ? 'pointer-events-none' : ''}`}
                                sandbox="allow-scripts allow-same-origin allow-forms"
                                onLoad={() => setIsLoading(false)}
                                onError={() => {
                                    console.error("Iframe failed to load");
                                    setIsLoading(false);
                                }}
                            />
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10 backdrop-blur-sm">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
                                        <span className="text-zinc-500 text-xs font-medium uppercase tracking-widest">Loading</span>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-zinc-400 bg-[#0B0B0C]">
                            <div className="text-center p-10">
                                <h1 className="text-xl font-bold mb-4 font-display">Initializing Context...</h1>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Circle Memory Mode Indicator */}
                {circleMemoryMode && !showSaveDialog && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-purple-500/90 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-2 z-20">
                        <Icons.Sparkles className="w-4 h-4" />
                        Click and drag to select an area
                    </div>
                )}

                {/* Selection Box Overlay */}
                {circleMemoryMode && selectionBox && (
                    <div
                        className="absolute border-2 border-dashed border-purple-400 bg-purple-500/20 pointer-events-none z-20 rounded"
                        style={{
                            left: selectionBox.x,
                            top: selectionBox.y,
                            width: selectionBox.width,
                            height: selectionBox.height
                        }}
                    />
                )}

                {/* Save Dialog */}
                {showSaveDialog && selectionBox && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30">
                        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-md shadow-2xl">
                            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                <Icons.Sparkles className="w-5 h-5 text-purple-400" />
                                Save Selection to Memory
                            </h3>
                            <div className="bg-black/50 rounded-lg p-4 mb-4">
                                <div className="text-purple-300 text-sm mb-2">
                                    Selected area: {Math.round(selectionBox.width)} × {Math.round(selectionBox.height)} px
                                </div>
                                <div className="text-zinc-500 text-xs">
                                    Position: ({Math.round(selectionBox.x)}, {Math.round(selectionBox.y)})
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="text-xs text-zinc-400 block mb-2">Describe what this area contains:</label>
                                <input
                                    type="text"
                                    value={memoryNote}
                                    onChange={(e) => setMemoryNote(e.target.value)}
                                    placeholder="e.g., 'Hero section', 'Navigation bar', 'Footer design'"
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSaveToMemory}
                                    className="flex-1 py-2 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Icons.CheckCircle className="w-4 h-4" />
                                    Save to Memory
                                </button>
                                <button
                                    onClick={handleCancelSelection}
                                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Health Check Repair Dialog */}
                {showRepairDialog && healthReport && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-40 animate-fade-in">
                        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${healthReport.status === 'broken'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                        <Icons.AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg">
                                            {healthReport.status === 'broken' ? 'Critical Issues Detected' : 'Issues Found'}
                                        </h3>
                                        <p className="text-zinc-500 text-sm">{healthReport.issues.length} problem{healthReport.issues.length > 1 ? 's' : ''} detected</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowRepairDialog(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                                >
                                    <Icons.X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Issues List */}
                            <div className="bg-black/50 rounded-xl p-4 mb-4 border border-white/5">
                                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Detected Issues:</div>
                                <ul className="space-y-2">
                                    {healthReport.issues.map((issue, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <span className="text-red-400 mt-0.5">•</span>
                                            <span className="text-zinc-300">{issue}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Repair Plan */}
                            {healthReport.repairPlan && (
                                <div className="flex-1 overflow-auto bg-black/30 rounded-xl border border-white/5 p-4 mb-4">
                                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Icons.Sparkles className="w-3 h-3 text-purple-400" />
                                        AI-Generated Repair Plan:
                                    </div>
                                    <div className="prose prose-invert prose-sm max-w-none text-zinc-300 overflow-auto max-h-64">
                                        <pre className="whitespace-pre-wrap text-xs font-mono bg-black/50 p-3 rounded-lg">
                                            {healthReport.repairPlan}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-2 border-t border-white/5">
                                <button
                                    onClick={applyRepairPlan}
                                    className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-primary text-black font-bold rounded-xl transition-all hover:shadow-[0_0_30px_rgba(52,211,153,0.3)] flex items-center justify-center gap-2"
                                >
                                    <Icons.Play className="w-4 h-4" />
                                    Approve & Fix
                                </button>
                                <button
                                    onClick={() => {
                                        applyRepairPlan();
                                        // Switch to edit mode after a short delay
                                        setTimeout(() => {
                                            dispatch({ type: 'SET_TAB', tab: TabId.Plan });
                                        }, 100);
                                    }}
                                    className="px-4 py-3 bg-blue-500/20 text-blue-300 font-bold rounded-xl hover:bg-blue-500/30 transition-colors flex items-center gap-2"
                                >
                                    <Icons.Pencil className="w-4 h-4" />
                                    Edit Plan
                                </button>
                                <button
                                    onClick={() => setShowRepairDialog(false)}
                                    className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-colors"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- View: Editor (Monaco) ---
export const EditorView = () => {
    const { state, dispatch } = useOrchestrator();

    // Flatten files for list
    const files = Object.entries(state.files);

    // Fallback: If no active file but files exist, select the first one
    const activeFile = state.activeFile || files[0]?.[0] || '';

    const monaco = useMonaco();

    useEffect(() => {
        if (monaco) {
            monaco.editor.defineTheme('goose-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [],
                colors: {
                    'editor.background': '#0B0B0C',
                }
            });
            monaco.editor.setTheme('goose-dark');
        }
    }, [monaco]);

    return (
        <div className="flex-1 flex flex-col m-4 rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-[#0B0B0C] backdrop-blur-3xl">
            {/* Top Tab Bar (Replaces duplicate Sidebar Explorer) */}
            <div className="h-10 border-b border-white/5 bg-black/20 flex items-center px-2 gap-1 overflow-x-auto">
                {files.map(([name]) => (
                    <button
                        key={name}
                        onClick={() => dispatch({ type: 'SELECT_FILE', filename: name })}
                        className={`
                            px-4 py-1.5 text-xs font-mono rounded-t-lg border-t-2 transition-all flex items-center gap-2 whitespace-nowrap
                            ${activeFile === name
                                ? 'bg-[#0B0B0C] text-white border-primary border-t-primary'
                                : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5'}
                        `}
                    >
                        <Icons.FileCode className={`w-3 h-3 ${activeFile === name ? 'text-primary' : 'opacity-50'}`} />
                        {name}
                    </button>
                ))}
            </div>

            {/* Monaco Container */}
            <div className="flex-1 relative">
                <Editor
                    height="100%"
                    defaultLanguage="html"
                    language={activeFile.endsWith('.css') ? 'css' : activeFile.endsWith('.js') || activeFile.endsWith('.ts') ? 'javascript' : 'html'}
                    value={state.files[activeFile] || '// Select a file'}
                    theme="goose-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', monospace",
                        scrollBeyondLastLine: false,
                        padding: { top: 20 },
                        lineNumbers: 'on',
                        renderLineHighlight: 'all',
                    }}
                />
            </div>
        </div>
    );
};

// --- View: Automation (Desktop/Browser) ---
export const AutomationView = () => {
    const { state, dispatch } = useOrchestrator();
    const [subTab, setSubTab] = useState<'desktop' | 'browser'>('desktop');
    const [logs, setLogs] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const handleRun = async () => {
        if (!state.automation.consentToken) {
            const consent = confirm("Security Gate:\n\nAllow Goose Ultra to control your mouse/keyboard?");
            if (consent) {
                dispatch({ type: 'SET_AUTOMATION_CONFIG', config: { consentToken: "valid-token-123" } });
            } else {
                return;
            }
        }

        setIsRunning(true);
        setLogs(prev => [...prev, `[${subTab.toUpperCase()}] Starting task...`]);
        try {
            if (subTab === 'desktop') {
                await MockComputerDriver.runAction('CLICK', { x: 100, y: 200 });
                setLogs(prev => [...prev, `[DESKTOP] Clicked at 100, 200`]);
                await MockComputerDriver.runAction('TYPE', { text: "Hello World" });
                setLogs(prev => [...prev, `[DESKTOP] Typed "Hello World"`]);
            } else {
                await MockBrowserDriver.navigate("http://localhost:3000");
                setLogs(prev => [...prev, `[BROWSER] Navigated to localhost`]);
                await MockBrowserDriver.assert(".hero-title");
                setLogs(prev => [...prev, `[BROWSER] Asserted .hero-title exists`]);
            }
            setLogs(prev => [...prev, `[${subTab.toUpperCase()}] Task Completed Successfully.`]);
        } catch (e) {
            setLogs(prev => [...prev, `[ERROR] Task Failed.`]);
        } finally {
            setIsRunning(false);
        }
    };

    const isArmed = subTab === 'desktop' ? state.automation.desktopArmed : state.automation.browserArmed;

    return (
        <div className="flex-1 flex flex-col p-6 animate-fade-in gap-6">
            <div className="flex items-center justify-between">
                <div className="glass-float p-1 rounded-xl flex gap-1">
                    <button onClick={() => setSubTab('desktop')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${subTab === 'desktop' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Desktop</button>
                    <button onClick={() => setSubTab('browser')} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${subTab === 'browser' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Browser</button>
                </div>

                <div className="flex items-center gap-4 bg-black/40 rounded-full px-4 py-2 border border-white/5">
                    <span className={`text-[10px] uppercase font-bold tracking-widest ${isArmed ? 'text-rose-500 animate-pulse' : 'text-zinc-600'}`}>
                        {isArmed ? 'Armed & Dangerous' : 'Safe Mode'}
                    </span>
                    <button
                        className={`w-10 h-5 rounded-full p-0.5 transition-colors ${isArmed ? 'bg-rose-500' : 'bg-zinc-700'}`}
                        onClick={() => {
                            const payload = subTab === 'desktop' ? { desktopArmed: !state.automation.desktopArmed } : { browserArmed: !state.automation.browserArmed };
                            dispatch({ type: 'SET_AUTOMATION_CONFIG', config: payload });
                        }}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isArmed ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>

            <div className="flex-1 rounded-3xl bg-[#050505] border border-white/10 flex flex-col relative overflow-hidden shadow-2xl">
                {!isArmed && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 backdrop-blur-md">
                        <div className="text-center p-10 border border-white/10 rounded-3xl bg-black/80 shadow-[0_0_50px_rgba(0,0,0,0.5)] transform scale-100 hover:scale-105 transition-transform duration-500">
                            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-6">
                                <Icons.ShieldAlert className="w-8 h-8 text-zinc-500" />
                            </div>
                            <h4 className="text-white font-display font-bold text-xl mb-2">Automation Locked</h4>
                            <p className="text-zinc-500 text-sm">Arm the system to authorize autonomous actions.</p>
                        </div>
                    </div>
                )}

                <div className="p-4 border-b border-white/5 bg-zinc-900/30 flex justify-between items-center backdrop-blur-sm">
                    <div className="flex gap-2 px-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                    </div>
                    <button
                        disabled={!isArmed || isRunning}
                        onClick={handleRun}
                        className="px-5 py-2 bg-white text-black text-xs font-bold rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:bg-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {isRunning ? 'Executing...' : 'Run Sequence'}
                    </button>
                </div>
                <div className="flex-1 p-6 font-mono text-xs overflow-y-auto space-y-3 bg-[#080808]">
                    {logs.length > 0 ? logs.map((l, i) => (
                        <div key={i} className="flex gap-4 text-zinc-300 group">
                            <span className="text-zinc-700 select-none border-r border-zinc-800 pr-4 w-8 text-right">{(i + 1).toString().padStart(2, '0')}</span>
                            <span className={`${l.includes('ERROR') ? 'text-red-400' : 'text-emerald-400'} font-medium`}>{l}</span>
                        </div>
                    )) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-800 gap-4">
                            <Icons.Terminal className="w-12 h-12 opacity-20" />
                            <span className="text-sm font-medium">System Idle</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
// --- View: Discover (Skills) ---
export const DiscoverView = () => {
    const { state, dispatch } = useOrchestrator();
    const [subTab, setSubTab] = useState<'catalog' | 'installed'>('catalog');
    const [activeSkill, setActiveSkill] = useState<string | null>(null);
    const [skillInput, setSkillInput] = useState('');
    const [skillOutput, setSkillOutput] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Skill Service State
    const [catalog, setCatalog] = useState<import('../types').SkillManifest[]>([]);
    const [installed, setInstalled] = useState<import('../types').SkillManifest[]>([]);

    // Import dynamically to avoid circular deps if any, or just use global singleton
    const [service, setService] = useState<any>(null);

    useEffect(() => {
        // Load service and wait for it to fully initialize
        import('../services/skillsService').then(async ({ skillsService }) => {
            await skillsService.ensureLoaded();
            setService(skillsService);
            setCatalog(skillsService.getCatalog());
            setInstalled(skillsService.getInstalled());
        });
    }, []);

    const handleRefresh = async () => {
        if (!service) return;
        setIsRefreshing(true);
        try {
            const newCatalog = await service.refreshCatalogFromUpstream();
            setCatalog([...newCatalog]); // Force refresh
        } catch (e) {
            console.error(e);
            alert("Failed to refresh catalog.");
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleInstall = async (id: string) => {
        if (!service) return;
        try {
            await service.installSkill(id);
            setInstalled([...service.getInstalled()]);
            alert("Skill installed!");
        } catch (e) {
            alert("Install failed");
        }
    };

    const handleUninstall = async (id: string) => {
        if (!service) return;
        await service.uninstallSkill(id);
        setInstalled([...service.getInstalled()]);
    };

    const handleRunSkill = async () => {
        if (!service || !activeSkill) return;
        setIsRunning(true);
        setSkillOutput(null);

        // Parse Inputs (Mock JSON parse for now, UI should generate form based on schema)
        let inputs = {};
        try {
            inputs = skillInput ? JSON.parse(skillInput) : {};
        } catch {
            // If simple string input is expected, wrap it?
            // For P0, we assume user types valid JSON or simple text if schema allows.
            // Let's assume input is raw for mapped fields if simple.
            // We'll pass raw input on a generic 'input' key if JSON fails?
            // Actually contract says inputsSchema is JSON Schema.
            // Fallback:
            inputs = { query: skillInput, expression: skillInput, input: skillInput };
        }

        const runId = Date.now().toString();
        const result = await service.runSkill({
            runId,
            skillId: activeSkill,
            inputs,
            sessionId: 'manual-run',
            context: { projectId: state.activeProject?.id || 'none', personaId: 'user', mode: 'manual' }
        });

        setIsRunning(false);
        if (result.success) {
            setSkillOutput(typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2));
        } else {
            setSkillOutput(`Error: ${result.error}\nLogs: ${result.logs.join('\n')}`);
        }
    };

    const displayedSkills = subTab === 'catalog' ? catalog : installed;

    return (
        <div className="flex-1 p-8 max-w-6xl mx-auto w-full animate-fade-in flex flex-col h-full overflow-hidden">
            <div className="shrink-0 mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Discover Skills</h2>
                    <p className="text-zinc-500 text-sm mt-1">Expand capabilities with Claude Skills & Tools</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
                        <button onClick={() => setSubTab('catalog')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${subTab === 'catalog' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}>Catalog</button>
                        <button onClick={() => setSubTab('installed')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${subTab === 'installed' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}>Installed ({installed.length})</button>
                    </div>
                </div>
            </div>

            {/* P0: Skills Onboarding Banner */}
            <div className="mb-8 p-6 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-2xl flex items-center justify-between">
                <div className="flex gap-6">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold border border-purple-500/30">1</span>
                            <span className="text-sm font-bold text-white">Browse & Install</span>
                        </div>
                        <p className="text-xs text-zinc-500 ml-8">Find capabilities in Catalog and install them.</p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold border border-purple-500/30">2</span>
                            <span className="text-sm font-bold text-white">Invoke in Chat</span>
                        </div>
                        <p className="text-xs text-zinc-500 ml-8">Propel the agent with <code className="bg-white/10 px-1 rounded text-pink-300">/skill name</code> or use the Tools picker.</p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold border border-purple-500/30">3</span>
                            <span className="text-sm font-bold text-white">Approve & Run</span>
                        </div>
                        <p className="text-xs text-zinc-500 ml-8">Grant permission and watch the agent code, search, or compute.</p>
                    </div>
                </div>
                <div className="h-full w-px bg-white/10 mx-4" />
                <div className="text-xs text-zinc-400 italic max-w-[200px]">
                    "Skills expand my brain. Install 'web-search' to give me eyes on the world."
                </div>
            </div>

            <div className="mb-4 flex justify-between items-center">
                <div className="text-xs text-zinc-500">
                    Source: <a href="https://github.com/anthropics/skills" target="_blank" rel="noreferrer" className="underline hover:text-white">anthropics/skills</a>
                </div>
                {subTab === 'catalog' && (
                    <button onClick={handleRefresh} disabled={isRefreshing} className="flex items-center gap-2 text-xs font-bold text-primary hover:text-emerald-300 disabled:opacity-50">
                        {isRefreshing ? <Icons.RefreshCw className="w-3 h-3 animate-spin" /> : <Icons.Download className="w-3 h-3" />}
                        Refresh Catalog
                    </button>
                )}
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Skills Grid */}
                <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20 active:cursor-grabbing">
                    {displayedSkills.map(skill => (
                        <button
                            key={skill.id}
                            onClick={() => { setActiveSkill(skill.id); setSkillOutput(null); setSkillInput(''); }}
                            className={`flex flex-col text-left p-5 rounded-2xl border transition-all duration-300 group relative
                                ${activeSkill === skill.id
                                    ? 'bg-white/10 border-primary/50 shadow-[0_0_30px_rgba(52,211,153,0.1)]'
                                    : 'bg-[#0B0B0C] border-white/5 hover:border-white/20 hover:bg-white/5'}
                            `}
                        >
                            <div className="flex justify-between items-start w-full mb-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeSkill === skill.id ? 'bg-primary text-black' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'}`}>
                                    <Icons.Terminal className="w-5 h-5" />
                                </div>
                                {installed.some(s => s.id === skill.id) && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">Installed</span>}
                            </div>

                            <h3 className="text-white font-bold mb-1">{skill.name}</h3>
                            <code className="text-[10px] text-zinc-600 font-mono mb-2 block">{skill.id}</code>
                            <p className="text-zinc-500 text-xs leading-relaxed line-clamp-3">{skill.description}</p>

                            <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2 w-full">
                                <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded">{skill.category}</span>
                                {skill.permissions.includes('network') && <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">Network</span>}
                            </div>
                        </button>
                    ))}
                    {displayedSkills.length === 0 && (
                        <div className="col-span-full text-center py-20 text-zinc-600">
                            <p>No skills found.</p>
                        </div>
                    )}
                </div>

                {/* Skill Runner Panel (Right Side) */}
                <AnimatePresence>
                    {activeSkill && (
                        <motion.div
                            initial={{ x: 50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 50, opacity: 0 }}
                            className="w-96 bg-[#0B0B0C] border border-white/10 rounded-2xl p-6 flex flex-col shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20" />

                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-white mb-1">{catalog.find(s => s.id === activeSkill)?.name || installed.find(s => s.id === activeSkill)?.name}</h3>
                                <div className="flex items-center gap-2 text-zinc-500 text-xs">
                                    <span>{catalog.find(s => s.id === activeSkill)?.version || '1.0.0'}</span>
                                    <span>•</span>
                                    <span>{catalog.find(s => s.id === activeSkill)?.author || 'Author'}</span>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col gap-4">
                                {subTab === 'catalog' && !service?.isInstalled(activeSkill) ? (
                                    <button onClick={() => handleInstall(activeSkill)} className="w-full py-3 bg-primary text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors shadow-lg">
                                        Install Skill
                                    </button>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1"><Icons.Check className="w-3 h-3" /> Installed</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => {
                                                    navigator.clipboard.writeText(`/skill ${activeSkill}`);
                                                    alert("Copied command: /skill " + activeSkill);
                                                }} className="text-primary text-xs hover:underline" title="Copy Chat Command">Copy '/skill {activeSkill}'</button>
                                                <button onClick={() => handleUninstall(activeSkill)} className="text-rose-500 text-xs hover:underline">Uninstall</button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Input (JSON/Text)</label>
                                            <textarea
                                                value={skillInput}
                                                onChange={(e) => setSkillInput(e.target.value)}
                                                placeholder={JSON.stringify({ query: "example" }, null, 2)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 min-h-[100px] font-mono resize-none"
                                            />
                                        </div>

                                        <button
                                            onClick={handleRunSkill}
                                            disabled={isRunning || !skillInput}
                                            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isRunning ? <Icons.RefreshCw className="w-4 h-4 animate-spin" /> : <Icons.Play className="w-4 h-4" />}
                                            {isRunning ? 'Running...' : 'Run Skill'}
                                        </button>

                                        {skillOutput && (
                                            <div className="flex-1 flex flex-col min-h-0 mt-2">
                                                <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Output</label>
                                                <div className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 text-xs font-mono text-zinc-300 overflow-y-auto whitespace-pre-wrap">
                                                    {skillOutput}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <button onClick={() => setActiveSkill(null)} className="absolute top-4 right-4 text-zinc-600 hover:text-white transition-colors">
                                <Icons.X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

// --- View: Computer Use (Vi Control Mode) ---
// Inspired by v Control UI - Industrial automation aesthetic
type ViControlTab = 'flow' | 'editor' | 'browser' | 'terminal' | 'settings' | 'vi_control';

interface ViNode {
    id: string;
    label: string;
    icon: React.ReactNode;
}

const VI_TACTICAL_NODES: ViNode[] = [
    { id: 'intent', label: 'Intent Analysis', icon: <Icons.Sparkles size={16} /> },
    { id: 'vision', label: 'Vision Scan', icon: <Icons.Eye size={16} /> },
    { id: 'plan', label: 'Automation Plan', icon: <Icons.FileText size={16} /> },
    { id: 'browser', label: 'Browser Navigation', icon: <Icons.Globe size={16} /> },
    { id: 'interaction', label: 'OS Interaction', icon: <Icons.Mouse size={16} /> },
    { id: 'qa', label: 'Verification', icon: <Icons.ShieldAlert size={16} /> },
    { id: 'server', label: 'Server Handshake', icon: <Icons.Server size={16} /> },
    { id: 'completion', label: 'Task Resolved', icon: <Icons.CheckCircle size={16} /> }
];

export const ComputerUseView = () => {
    const { state, dispatch } = useOrchestrator();
    const [activeTab, setActiveTab] = useState<ViControlTab>('flow');
    const [command, setCommand] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [isInterpreting, setIsInterpreting] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [output, setOutput] = useState<string[]>([]);
    const [sshConfig, setSshConfig] = useState({ host: '', port: '22', user: 'root' });

    const tabs: { id: ViControlTab; name: string; icon: React.ReactNode; color: string }[] = [
        { id: 'flow', name: 'Flow', icon: <Icons.Target className="w-4 h-4" />, color: 'emerald' },
        { id: 'vi_control', name: 'Vi Control', icon: <Icons.ShieldCheck className="w-4 h-4" />, color: 'emerald' }
    ];

    const handleExecuteCommand = async () => {
        if (!command.trim()) return;

        const userCommand = command;
        setCommand('');
        setIsInterpreting(true);
        setOutput(prev => [...prev, `> ${userCommand}`]);

        const intent = parseUserIntent(userCommand);
        setOutput(prev => [...prev, `[Vi Agent] 📋 Analyzing intent...`]);

        const plan = generateTaskPlan(userCommand);
        const validation = validatePlan(plan);
        if (!validation.valid) {
            setOutput(prev => [...prev, `[Vi Agent] ⚠️ Plan validation failed:`]);
            validation.errors.forEach(err => setOutput(prev => [...prev, `  ❌ ${err}`]));
            setIsInterpreting(false);
            return;
        }

        setIsInterpreting(false);
        setIsExecuting(true);
        setCurrentStep(0);

        const executor = new ViAgentExecutor(plan, {
            onPhaseStart: (phase, idx) => setOutput(prev => [...prev, `\n━━━ Phase ${idx + 1}: ${phase.name} ━━━`]),
            onStepStart: (step, phaseIdx, stepIdx) => {
                setCurrentStep(phaseIdx * 10 + stepIdx);
                setOutput(prev => [...prev, `  ▶ ${step.description}...`]);
            },
            onStepComplete: (step, result) => {
                if (result.success) setOutput(prev => [...prev, `    ✓ ${result.output || 'Success'}`]);
            },
            onStepFailed: (step, error) => setOutput(prev => [...prev, `    ❌ Failed: ${error}`]),
            onComplete: (plan) => {
                const completed = plan.phases.every(p => p.status === 'completed');
                if (completed) setOutput(prev => [...prev, `\n[Vi Agent] ✅ Component execution cycle finished.`]);
            }
        });

        try {
            await executor.execute();
        } catch (err: any) {
            setOutput(prev => [...prev, `[Vi Agent] ❌ Executor error: ${err.message}`]);
        }
        setIsExecuting(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 flex flex-col bg-[#09090b] text-zinc-100 overflow-hidden"
        >
            <header className="h-10 border-b border-zinc-800/60 flex items-center px-4 justify-between bg-[#09090b] z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => dispatch({ type: 'SET_MODE', mode: GlobalMode.Build })}>
                        <Icons.Zap className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                        <span className="text-[11px] font-black uppercase tracking-widest">Vi <span className="text-emerald-500 italic">Control</span></span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => dispatch({ type: 'SET_MODE', mode: GlobalMode.Build })} className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded-lg text-[10px] font-bold hover:bg-zinc-700 transition-colors flex items-center gap-1.5">
                        <Icons.X className="w-3 h-3" /> Exit
                    </button>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                <div className="w-60 bg-[#09090b] border-r border-zinc-800 flex flex-col">
                    <div className="h-9 flex items-center px-4 justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800/40">
                        <span>Vi Explorer</span>
                    </div>
                    <div className="flex-1 overflow-auto py-2">
                        <div className="px-4 py-3">
                            <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">Manual Control</div>
                            <input
                                value={sshConfig.host}
                                onChange={(e) => setSshConfig(prev => ({ ...prev, host: e.target.value }))}
                                placeholder="Remote Host IP"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] text-white focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-[#0c0c0e]">
                    <div className="h-14 bg-[#09090b] flex items-center px-4 gap-1.5 border-b border-zinc-800/60 overflow-x-auto">
                        {tabs.map((tab) => (
                            <div
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`h-9 flex items-center px-4 gap-3 cursor-pointer text-[12px] font-semibold rounded-lg transition-all ${activeTab === tab.id ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'text-zinc-500 hover:bg-zinc-800/50'}`}
                            >
                                <span className={tab.color === 'emerald' ? 'text-emerald-500' : 'text-zinc-400'}>{tab.icon}</span>
                                <span>{tab.name}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 relative overflow-hidden bg-[#0c0c0e]">
                        <AnimatePresence mode="wait">
                            {activeTab === 'flow' && (
                                <motion.div key="flow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full w-full p-12 flex flex-col items-center justify-center">
                                    <div className="relative flex flex-col gap-10 w-full max-w-2xl">
                                        {VI_TACTICAL_NODES.map((node, index) => (
                                            <div key={node.id} className="relative flex items-center group">
                                                <div className={`w-12 h-12 rounded-[18px] flex items-center justify-center border ${index === currentStep && isExecuting ? 'border-emerald-400 bg-emerald-400/10' : index < currentStep ? 'bg-emerald-500 text-black' : 'border-zinc-800 opacity-30'}`}>
                                                    {index < currentStep ? <Icons.Check className="w-4 h-4" /> : node.icon}
                                                </div>
                                                <div className="ml-10">
                                                    <h4 className={`text-lg font-black uppercase tracking-tighter ${index === currentStep && isExecuting ? 'text-white' : 'text-zinc-500'}`}>{node.label}</h4>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                            {activeTab === 'vi_control' && (
                                <motion.div key="vi_control" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full w-full">
                                    <ViControlView />
                                </motion.div>
                            )}

                        </AnimatePresence>
                    </div>
                </div>

                <div className="w-80 bg-[#09090b] border-l border-zinc-800 flex flex-col">
                    <div className="p-4 border-b border-zinc-800/40 text-[11px] font-black text-zinc-200 uppercase tracking-widest flex items-center gap-2">
                        <Icons.Sparkles className="w-4 h-4 text-emerald-500" /> Vi Agent
                    </div>
                    <div className="flex-1 overflow-auto p-4 flex flex-col">
                        <div className="flex-1 bg-black/50 rounded-xl border border-zinc-800 p-4 font-mono text-[11px] space-y-1 overflow-y-auto mb-4 custom-scrollbar">
                            {output.map((line, i) => <div key={i} className="text-zinc-400">{line}</div>)}
                        </div>
                        <input
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleExecuteCommand()}
                            placeholder="Input command..."
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                        />
                    </div>
                </div>
            </main>
        </motion.div>
    );
};
