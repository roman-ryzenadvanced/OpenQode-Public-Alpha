import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { OrchestratorState, OrchestratorContext, GlobalMode, TabId, Project, StepLog } from './types';
import { INITIAL_CONTEXT } from './constants';

// --- Actions ---
type Action =
  | { type: 'SELECT_PROJECT'; projectId: string }
  | { type: 'CREATE_PROJECT'; name: string; template?: string; id?: string; createdAt?: number; originalPrompt?: string }
  | { type: 'SET_PROJECTS'; projects: Project[]; activeProjectId?: string | null }
  | { type: 'UPDATE_PROJECT'; project: Project }
  | { type: 'DELETE_PROJECT'; projectId: string }
  | { type: 'SET_MODE'; mode: GlobalMode }
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'TRANSITION'; to: OrchestratorState }
  | { type: 'UPDATE_PLAN'; plan: string }
  | { type: 'UPDATE_FILES'; files: Record<string, string> }
  | { type: 'ADD_LOG'; log: StepLog }
  | { type: 'UPDATE_LOG'; id: string; message: string }
  | { type: 'REMOVE_LOG'; id: string }
  | { type: 'SET_AUTOMATION_CONFIG'; config: Partial<OrchestratorContext['automation']> }
  | { type: 'SELECT_FILE'; filename: string }
  | { type: 'UPDATE_STREAMING_CODE'; code: string | null }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_CHAT_DOCK' }
  | { type: 'START_BUILD_SESSION'; sessionId: string }
  | { type: 'END_BUILD_SESSION'; sessionId: string }
  | { type: 'RESOLVE_PLAN'; signature: string; resolution: 'approved' | 'rejected' }
  | { type: 'SET_PREVIEW_MAX_MODE'; enabled: boolean }
  | { type: 'SET_CHAT_PERSONA'; persona: OrchestratorContext['chatPersona'] }
  | { type: 'SET_CUSTOM_CHAT_PERSONA'; name: string; prompt: string }
  | { type: 'RESET_PROJECT' }
  | { type: 'SET_SKILL_CATALOG'; catalog: OrchestratorContext['skills'] }
  | { type: 'INSTALL_SKILL'; skill: import('./types').SkillManifest }
  | { type: 'UNINSTALL_SKILL'; skillId: string }
  | { type: 'OPEN_PERSONA_MODAL' }
  | { type: 'CLOSE_PERSONA_MODAL' }
  | { type: 'UPDATE_PERSONA_DRAFT'; draft: Partial<OrchestratorContext['personaDraft']> }
  | { type: 'START_PERSONA_GENERATION'; requestId: string }
  | { type: 'SET_PERSONA_CANDIDATE'; candidate: import('./types').Persona | null }
  | { type: 'SET_PERSONA_GENERATION_ERROR'; error: string | null }
  | { type: 'APPROVE_PERSONA'; persona: import('./types').Persona }
  | { type: 'REJECT_PERSONA'; requestId: string }
  | { type: 'SET_ACTIVE_PERSONA'; personaId: string | null }
  | { type: 'LOAD_PERSONAS_FROM_DISK'; personas: import('./types').Persona[] }
  // IT Expert Execution Actions
  | { type: 'SET_EXECUTION_SETTINGS'; settings: Partial<import('./types').ExecutionSettings> }
  | { type: 'SET_PENDING_PROPOSAL'; proposal: import('./types').ActionProposal | null }
  | { type: 'APPROVE_PROPOSAL'; proposalId: string }
  | { type: 'REJECT_PROPOSAL'; proposalId: string }
  | { type: 'START_EXECUTION'; execSessionId: string }
  | { type: 'UPDATE_EXECUTION_RESULT'; result: import('./types').ActionProposal['result'] }
  | { type: 'CANCEL_EXECUTION' }
  | { type: 'COMPLETE_EXECUTION'; exitCode: number }
  // Context Feed Actions
  | { type: 'SET_CONTEXT_FEED_ENABLED'; enabled: boolean }
  | { type: 'SET_CONTEXT_FEED_TOPIC'; topic: string }
  | { type: 'SET_CONTEXT_FEED_LOADING'; isLoading: boolean }
  | { type: 'UPSERT_CONTEXT_FEED_ITEMS'; items: import('./types').ContextFeedItem[] }
  | { type: 'PIN_CONTEXT_FEED_ITEM'; itemId: string }
  | { type: 'UNPIN_CONTEXT_FEED_ITEM'; itemId: string }
  | { type: 'CLEAR_CONTEXT_FEED' }
  // Request Session Actions (Cancel/Edit/Resend)
  | { type: 'START_REQUEST'; sessionId: string; messageDraft: string; attachmentsDraft?: import('./types').AttachmentDraft[] }
  | { type: 'CANCEL_REQUEST' }
  | { type: 'REQUEST_COMPLETE' }
  | { type: 'REQUEST_ERROR' }
  | { type: 'EDIT_AND_RESEND' }
  // LAYER 2: Stream Session Gating Actions
  | { type: 'START_STREAM_SESSION'; sessionId: string }
  | { type: 'END_STREAM_SESSION'; sessionId: string }
  | { type: 'CANCEL_STREAM_SESSION'; sessionId: string }
  | { type: 'SET_PREFERRED_FRAMEWORK'; framework: string | null }
  | { type: 'SET_STATE'; state: OrchestratorState }
  // Apex Level PASS
  // Apex Level PASS
  | { type: 'TOGGLE_APEX_MODE' }
  // Chat Settings
  | { type: 'SET_CHAT_MODEL'; model: string }
  | { type: 'TOGGLE_OLLAMA'; enabled: boolean }
  | { type: 'SET_AVAILABLE_MODELS'; models: string[] };

// --- Helper: Tab Eligibility ---
// Strictly enforces "Tab validity" rule
export const getEnabledTabs = (state: OrchestratorState): TabId[] => {
  switch (state) {
    case OrchestratorState.NoProject:
      return [TabId.Start, TabId.Discover, TabId.ViControl];
    case OrchestratorState.ProjectSelected:
      return [TabId.Plan, TabId.ViControl];
    case OrchestratorState.IdeaCapture:
    case OrchestratorState.IQExchange:
    case OrchestratorState.Planning:
      return [TabId.Plan, TabId.ViControl];
    case OrchestratorState.PlanReady:
      return [TabId.Plan, TabId.ViControl]; // User must approve before building
    case OrchestratorState.Building:
      return [TabId.Plan, TabId.Editor, TabId.ViControl]; // Read-only editor
    case OrchestratorState.PreviewReady:
    case OrchestratorState.PreviewError:
      return [TabId.Plan, TabId.Editor, TabId.Preview, TabId.ViControl];
    case OrchestratorState.Editing:
      return [TabId.Plan, TabId.Editor, TabId.Preview, TabId.ViControl];
    default:
      return [TabId.Start, TabId.ViControl];
  }
};

// --- Reducer ---
const reducer = (state: OrchestratorContext, action: Action): OrchestratorContext => {
  switch (action.type) {
    case 'SELECT_PROJECT': {
      const project = state.projects.find(p => p.id === action.projectId);
      if (!project) return state;
      return {
        ...state,
        activeProject: project,
        state: OrchestratorState.ProjectSelected,
        activeTab: TabId.Plan,
        globalMode: GlobalMode.Build
      };
    }
    case 'SET_PROJECTS': {
      const active = action.activeProjectId
        ? action.projects.find(p => p.id === action.activeProjectId) || null
        : null;
      return {
        ...state,
        projects: action.projects,
        activeProject: active ?? state.activeProject,
      };
    }
    case 'UPDATE_PROJECT': {
      const projects = state.projects.map(p => (p.id === action.project.id ? action.project : p));
      const activeProject = state.activeProject?.id === action.project.id ? action.project : state.activeProject;
      return { ...state, projects, activeProject };
    }
    case 'DELETE_PROJECT': {
      const projects = state.projects.filter(p => p.id !== action.projectId);
      const deletingActive = state.activeProject?.id === action.projectId;
      return {
        ...state,
        projects,
        activeProject: deletingActive ? null : state.activeProject,
        state: deletingActive ? OrchestratorState.NoProject : state.state,
        activeTab: deletingActive ? TabId.Start : state.activeTab,
        plan: deletingActive ? null : state.plan,
        files: deletingActive ? {} : state.files,
        activeFile: deletingActive ? null : state.activeFile,
        resolvedPlans: deletingActive ? {} : state.resolvedPlans,
        timeline: deletingActive ? [] : state.timeline
      };
    }
    case 'CREATE_PROJECT': {
      const createdAt = action.createdAt ?? Date.now();
      const id = action.id ?? createdAt.toString();
      const newProject: Project = {
        id,
        name: action.name,
        slug: action.name.toLowerCase().replace(/\s+/g, '-'),
        createdAt,
        description: action.template ? `Forked from ${action.template}` : 'New Vibe Project',
        originalPrompt: action.originalPrompt || undefined // LAYER 5: Preserve original request
      };
      // CRITICAL FIX: Preserve user's globalMode if they are in Chat/Brainstorm.
      // Only switch to Build mode if coming from Discover (the welcome state).
      const shouldSwitchToBuild = state.globalMode === GlobalMode.Discover;
      return {
        ...state,
        projects: [newProject, ...state.projects],
        activeProject: newProject,
        state: OrchestratorState.ProjectSelected,
        activeTab: shouldSwitchToBuild ? TabId.Plan : state.activeTab,
        globalMode: shouldSwitchToBuild ? GlobalMode.Build : state.globalMode
      };
    }
    case 'SET_MODE':
      return { ...state, globalMode: action.mode };
    case 'SET_TAB': {
      // Guard: Check if tab is enabled for current state
      const enabled = getEnabledTabs(state.state);
      if (!enabled.includes(action.tab)) return state;
      return { ...state, activeTab: action.tab };
    }
    case 'TRANSITION':
      // Basic transition validation could go here
      return { ...state, state: action.to };
    case 'SET_STATE':
      // Direct state override for emergency/reset scenarios
      return { ...state, state: action.state };
    case 'UPDATE_PLAN':
      return { ...state, plan: action.plan };
    case 'UPDATE_FILES':
      return { ...state, files: { ...state.files, ...action.files }, activeFile: Object.keys(action.files)[0] || null };
    case 'UPDATE_STREAMING_CODE':
      return { ...state, streamingCode: action.code };
    case 'SELECT_FILE':
      return { ...state, activeFile: action.filename, activeTab: TabId.Editor };
    case 'ADD_LOG':
      return { ...state, timeline: [...state.timeline, action.log] };
    case 'UPDATE_LOG':
      return { ...state, timeline: state.timeline.map(log => log.id === action.id ? { ...log, message: action.message } : log) };
    case 'REMOVE_LOG':
      return { ...state, timeline: state.timeline.filter(log => log.id !== action.id) };
    case 'SET_AUTOMATION_CONFIG':
      return { ...state, automation: { ...state.automation, ...action.config } };
    case 'RESET_PROJECT':
      return {
        ...state,
        activeProject: null,
        state: OrchestratorState.NoProject,
        activeTab: TabId.Start,
        plan: null,
        files: {},
        activeFile: null,
        resolvedPlans: {},
        timeline: []
      };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'TOGGLE_CHAT_DOCK':
      return { ...state, chatDocked: state.chatDocked === 'right' ? 'bottom' : 'right' };
    case 'SET_PREVIEW_MAX_MODE':
      return { ...state, previewMaxMode: action.enabled };
    case 'SET_CHAT_PERSONA':
      return { ...state, chatPersona: action.persona };
    case 'SET_CUSTOM_CHAT_PERSONA':
      return { ...state, customChatPersonaName: action.name, customChatPersonaPrompt: action.prompt, chatPersona: 'custom' };
    case 'START_BUILD_SESSION':
      return { ...state, activeBuildSessionId: action.sessionId, streamingCode: '' };
    case 'END_BUILD_SESSION':
      // Only clear if matching session provided
      if (state.activeBuildSessionId === action.sessionId) {
        return { ...state, activeBuildSessionId: null, streamingCode: null };
      }
      return state;
    case 'RESOLVE_PLAN':
      return {
        ...state,
        resolvedPlans: { ...state.resolvedPlans, [action.signature]: action.resolution }
      };
    case 'SET_SKILL_CATALOG':
      return { ...state, skills: action.catalog };
    case 'INSTALL_SKILL': {
      const installed = [...state.skills.installed.filter(s => s.id !== action.skill.id), action.skill];
      return {
        ...state,
        skills: { ...state.skills, installed }
      };
    }
    case 'UNINSTALL_SKILL': {
      const installed = state.skills.installed.filter(s => s.id !== action.skillId);
      return {
        ...state,
        skills: { ...state.skills, installed }
      };
    }
    case 'OPEN_PERSONA_MODAL':
      return { ...state, personaCreateModalOpen: true, personaGeneration: { status: 'idle', requestId: null, candidate: null, error: null } };
    case 'CLOSE_PERSONA_MODAL':
      return { ...state, personaCreateModalOpen: false };
    case 'UPDATE_PERSONA_DRAFT':
      return { ...state, personaDraft: { ...state.personaDraft, ...action.draft } };
    case 'START_PERSONA_GENERATION':
      return { ...state, personaGeneration: { ...state.personaGeneration, status: 'generating', requestId: action.requestId, error: null } };
    case 'SET_PERSONA_CANDIDATE':
      return { ...state, personaGeneration: { ...state.personaGeneration, status: 'awaitingApproval', candidate: action.candidate, error: null } };
    case 'SET_PERSONA_GENERATION_ERROR':
      return { ...state, personaGeneration: { ...state.personaGeneration, status: 'error', error: action.error } };
    case 'APPROVE_PERSONA': {
      const personas = [...state.personas.filter(p => p.id !== action.persona.id), action.persona];
      return {
        ...state,
        personas,
        activePersonaId: action.persona.id,
        personaCreateModalOpen: false,
        personaGeneration: { status: 'idle', requestId: null, candidate: null, error: null }
      };
    }
    case 'REJECT_PERSONA':
      if (state.personaGeneration.requestId === action.requestId) {
        return { ...state, personaGeneration: { status: 'idle', requestId: null, candidate: null, error: null } };
      }
      return state;
    case 'SET_ACTIVE_PERSONA':
      return { ...state, activePersonaId: action.personaId };
    case 'LOAD_PERSONAS_FROM_DISK':
      return { ...state, personas: action.personas };

    // IT Expert Execution Reducer Cases
    case 'SET_EXECUTION_SETTINGS':
      return { ...state, executionSettings: { ...state.executionSettings, ...action.settings } };
    case 'SET_PENDING_PROPOSAL':
      return { ...state, pendingProposal: action.proposal };
    case 'APPROVE_PROPOSAL': {
      if (!state.pendingProposal || state.pendingProposal.proposalId !== action.proposalId) return state;
      return { ...state, pendingProposal: { ...state.pendingProposal, status: 'executing' } };
    }
    case 'REJECT_PROPOSAL': {
      if (!state.pendingProposal || state.pendingProposal.proposalId !== action.proposalId) return state;
      const rejected = { ...state.pendingProposal, status: 'rejected' as const };
      return { ...state, pendingProposal: null, proposalHistory: [...state.proposalHistory, rejected] };
    }
    case 'START_EXECUTION':
      return { ...state, activeExecSessionId: action.execSessionId };
    case 'UPDATE_EXECUTION_RESULT': {
      if (!state.pendingProposal) return state;
      return { ...state, pendingProposal: { ...state.pendingProposal, result: action.result } };
    }
    case 'CANCEL_EXECUTION': {
      if (!state.pendingProposal) return state;
      const cancelled = { ...state.pendingProposal, status: 'cancelled' as const };
      return { ...state, pendingProposal: null, activeExecSessionId: null, proposalHistory: [...state.proposalHistory, cancelled] };
    }
    case 'COMPLETE_EXECUTION': {
      if (!state.pendingProposal) return state;
      const completed = { ...state.pendingProposal, status: action.exitCode === 0 ? 'completed' as const : 'failed' as const };
      return { ...state, pendingProposal: null, activeExecSessionId: null, proposalHistory: [...state.proposalHistory, completed] };
    }

    // Context Feed Reducer Cases
    case 'SET_CONTEXT_FEED_ENABLED':
      return { ...state, contextFeed: { ...state.contextFeed, enabled: action.enabled } };
    case 'SET_CONTEXT_FEED_TOPIC':
      return { ...state, contextFeed: { ...state.contextFeed, activeTopic: action.topic } };
    case 'SET_CONTEXT_FEED_LOADING':
      return { ...state, contextFeed: { ...state.contextFeed, isLoading: action.isLoading } };
    case 'UPSERT_CONTEXT_FEED_ITEMS': {
      // Merge new items, keeping pinned items at top
      const existingIds = new Set(state.contextFeed.items.map(i => i.id));
      const newItems = action.items.filter(i => !existingIds.has(i.id));
      const updatedItems = [...state.contextFeed.items.filter(i => state.contextFeed.pinnedItemIds.includes(i.id)), ...newItems.slice(0, 10)];
      return { ...state, contextFeed: { ...state.contextFeed, items: updatedItems, lastUpdatedAt: new Date().toISOString(), isLoading: false } };
    }
    case 'PIN_CONTEXT_FEED_ITEM': {
      if (state.contextFeed.pinnedItemIds.includes(action.itemId)) return state;
      return { ...state, contextFeed: { ...state.contextFeed, pinnedItemIds: [...state.contextFeed.pinnedItemIds, action.itemId] } };
    }
    case 'UNPIN_CONTEXT_FEED_ITEM':
      return { ...state, contextFeed: { ...state.contextFeed, pinnedItemIds: state.contextFeed.pinnedItemIds.filter(id => id !== action.itemId) } };
    case 'CLEAR_CONTEXT_FEED':
      return { ...state, contextFeed: { ...state.contextFeed, items: state.contextFeed.items.filter(i => state.contextFeed.pinnedItemIds.includes(i.id)), activeTopic: '' } };

    // Request Session Reducer Cases
    case 'START_REQUEST':
      return {
        ...state,
        activeRequestSessionId: action.sessionId,
        activeRequestStatus: 'thinking',
        lastUserMessageDraft: action.messageDraft,
        lastUserAttachmentsDraft: action.attachmentsDraft || null
      };
    case 'CANCEL_REQUEST':
      return { ...state, activeRequestStatus: 'cancelled', activeRequestSessionId: null };
    case 'REQUEST_COMPLETE':
      return { ...state, activeRequestStatus: 'completed', activeRequestSessionId: null };
    case 'REQUEST_ERROR':
      return { ...state, activeRequestStatus: 'error', activeRequestSessionId: null };
    case 'EDIT_AND_RESEND':
      // Just mark intent; UI will populate composer from lastUserMessageDraft
      return { ...state, activeRequestStatus: 'idle' };

    // LAYER 2: Stream Session Gating Reducer Cases
    case 'START_STREAM_SESSION':
      return { ...state, activeStreamSessionId: action.sessionId };
    case 'END_STREAM_SESSION':
      // Only clear if matching session
      if (state.activeStreamSessionId === action.sessionId) {
        return { ...state, activeStreamSessionId: null };
      }
      return state;
    case 'CANCEL_STREAM_SESSION':
      // Add to cancelled list and clear active if matching
      return {
        ...state,
        cancelledSessionIds: [...(state.cancelledSessionIds || []), action.sessionId],
        activeStreamSessionId: state.activeStreamSessionId === action.sessionId ? null : state.activeStreamSessionId
      };

    case 'SET_PREFERRED_FRAMEWORK':
      return { ...state, preferredFramework: action.framework };

    case 'TOGGLE_APEX_MODE':
      return { ...state, apexModeEnabled: !state.apexModeEnabled };

    case 'SET_CHAT_MODEL':
      // Sync to localStorage so services can read it
      try { localStorage.setItem('goose-active-model', action.model); } catch { }
      return { ...state, chatSettings: { ...state.chatSettings, activeModel: action.model } };

    case 'TOGGLE_OLLAMA':
      return { ...state, chatSettings: { ...state.chatSettings, ollamaEnabled: action.enabled } };

    case 'SET_AVAILABLE_MODELS':
      return { ...state, chatSettings: { ...state.chatSettings, availableModels: action.models } };

    default:
      return state;
  }
};

// --- Context & Hook ---
const Context = createContext<{ state: OrchestratorContext; dispatch: React.Dispatch<Action> } | null>(null);

export const OrchestratorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, INITIAL_CONTEXT);

  // Effect: Load persisted projects + last active on startup
  useEffect(() => {
    const electron = (window as any).electron;
    if (!electron) return;

    (async () => {
      try {
        const svc = await import('./services/automationService');
        const projects = await svc.listProjectsFromDisk();
        const lastActive = await svc.readLastActiveProjectId();
        const personas = await svc.loadPersonasFromDisk();

        if (personas.length) {
          dispatch({ type: 'LOAD_PERSONAS_FROM_DISK', personas });
        }

        if (projects.length) {
          dispatch({ type: 'SET_PROJECTS', projects, activeProjectId: lastActive });
        }

        if (lastActive) {
          const files = await svc.loadProjectFilesFromDisk(lastActive);
          if (Object.keys(files).length) {
            dispatch({ type: 'UPDATE_FILES', files });
            dispatch({ type: 'TRANSITION', to: OrchestratorState.PreviewReady });
            dispatch({ type: 'SET_TAB', tab: TabId.Preview });
          }
        }
      } catch (e) {
        console.warn('[Persist] Failed to load projects:', e);
      }
    })();
  }, []);

  // Effect: Auto-switch tabs if current becomes invalid
  useEffect(() => {
    const enabled = getEnabledTabs(state.state);
    if (!enabled.includes(state.activeTab)) {
      // Default to first enabled tab
      dispatch({ type: 'SET_TAB', tab: enabled[0] });
    }
  }, [state.state, state.activeTab]);

  // Effect: Persist Personas
  useEffect(() => {
    if (state.personas.length > 0) {
      import('./services/automationService').then(svc => {
        svc.savePersonasToDisk(state.personas);
      });
    }
  }, [state.personas]);

  return React.createElement(Context.Provider, { value: { state, dispatch } }, children);
};

export const useOrchestrator = () => {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useOrchestrator must be used within Provider");
  return ctx;
};
