// --- Orchestrator & State Machine ---

export enum OrchestratorState {
  NoProject = 'NoProject',
  ProjectSelected = 'ProjectSelected',
  IdeaCapture = 'IdeaCapture',
  IQExchange = 'IQExchange',
  Planning = 'Planning',
  PlanReady = 'PlanReady',  // NEW: Plan generated, awaiting user approval
  Building = 'Building',
  PreviewLoading = 'PreviewLoading',
  PreviewReady = 'PreviewReady',
  PreviewError = 'PreviewError',
  Editing = 'Editing'
}

export enum GlobalMode {
  Build = 'Build',
  GameDev = 'GameDev',
  OfficeAssist = 'OfficeAssist',
  ComputerUse = 'ComputerUse',
  Brainstorm = 'Brainstorm',
  Chat = 'Chat',
  UXDesigner = 'UXDesigner',
  Opus = 'Opus',
  Discover = 'Discover'
}

export enum TabId {
  Start = 'Start',
  Discover = 'Discover',
  Plan = 'Plan',
  Editor = 'Editor',
  Preview = 'Preview',
  ViControl = 'vi_control' // NEW
}

// VI CONTROL DATA MODELS (Contract v5)
export interface ViHost {
  hostId: string;
  label: string;
  protocol: 'ssh' | 'sftp' | 'scp' | 'ftp' | 'ftps' | 'rdp';
  hostname: string;
  port: number;
  username: string;
  osHint: 'windows' | 'linux' | 'mac';
  tags: string[];
  credId: string;
}

export interface ViCredential {
  credentialId: string;
  label: string;
  type: 'password' | 'ssh_key' | 'token';
}

export interface ViRunbook {
  runbookId: string;
  title: string;
  description: string;
  targets: string[]; // hostIds
  steps: string[];
  risk: 'low' | 'medium' | 'high';
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
  description?: string;
  originalPrompt?: string; // LAYER 5: Context Preservation - Store the original user request
}

export interface Persona {
  id: string;
  name: string;
  subtitle: string;
  icon: 'assistant' | 'therapist' | 'business' | 'it' | 'designer' | 'office' | 'custom' | 'sparkles';
  systemPrompt: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface StepLog {
  id: string;
  timestamp: number;
  type: 'user' | 'system' | 'automation' | 'error';
  message: string;
  artifacts?: {
    screenshotUrl?: string;
    diff?: string;
    logs?: string;
  };
}

export interface Diagnostics {
  resolvedPath: string;
  status: 'ok' | 'error';
  httpStatus?: number;
  messages: string[];
}

export interface AutomationConfig {
  desktopArmed: boolean;
  browserArmed: boolean;
  serverArmed: boolean;
  consentToken: string | null;
}

export interface OrchestratorContext {
  state: OrchestratorState;
  globalMode: GlobalMode;
  activeProject: Project | null;
  activeTab: TabId;
  projects: Project[];
  skills: {
    catalog: import('./types').SkillManifest[];
    installed: import('./types').SkillManifest[];
  };

  // Data State
  plan: string | null; // Markdown plan
  files: Record<string, string>; // Mock file system
  activeFile: string | null; // Currently selected file for editing
  activeBuildSessionId: string | null; // Unique ID for the current build session
  streamingCode: string | null; // For "Matrix" style code generation visualization
  timeline: StepLog[];
  diagnostics: Diagnostics | null;
  automation: AutomationConfig;
  resolvedPlans: Record<string, 'approved' | 'rejected'>; // Plan signatures that were already acted on

  // UI State
  chatDocked: 'right' | 'bottom';
  sidebarOpen: boolean;
  previewMaxMode: boolean;
  chatPersona: 'assistant' | 'therapist' | 'business' | 'it' | 'designer' | 'office' | 'custom';
  customChatPersonaName: string;
  customChatPersonaPrompt: string;
  skillRegistry: SkillRegistry;

  // Persona Feature State
  personas: Persona[];
  activePersonaId: string | null;
  personaCreateModalOpen: boolean;
  personaDraft: {
    name: string;
    purpose: string;
    tone: string;
    constraints: string;
  };
  personaGeneration: {
    status: 'idle' | 'generating' | 'awaitingApproval' | 'error';
    requestId: string | null;
    candidate: Persona | null;
    error: string | null;
  };

  // IT Expert Execution Agent State
  executionSettings: ExecutionSettings;
  activeExecSessionId: string | null;
  pendingProposal: ActionProposal | null;
  proposalHistory: ActionProposal[];

  // Live Context Feed State (for Chat-mode consulting personas)
  contextFeed: ContextFeedState;

  // Request Session State (for Cancel/Edit/Resend)
  activeRequestSessionId: string | null;
  activeRequestStatus: 'idle' | 'thinking' | 'cancelled' | 'completed' | 'error';
  lastUserMessageDraft: string | null;
  lastUserAttachmentsDraft: AttachmentDraft[] | null;

  // LAYER 2: Session Gating - Prevent cross-talk
  activeStreamSessionId: string | null;  // Current active stream session
  cancelledSessionIds: string[];         // Sessions that were cancelled (ignore their events)

  // Settings
  preferredFramework: string | null;
  chatSettings: {
    activeModel: string;
    ollamaEnabled: boolean;
    availableModels: string[];
  };

  // Apex Level PASS - Elite Developer Mode
  apexModeEnabled: boolean;
}

// --- Attachment Types ---
export interface AttachmentDraft {
  id: string;
  name: string;
  type: 'text' | 'image' | 'spreadsheet';
  extension: string;
  sizeBytes: number;
  content?: string; // For text files
  base64?: string; // For images
  manifest?: Record<string, unknown>; // Processed manifest for AI
}

// --- Live Context Feed ---

export interface ContextFeedItem {
  id: string;
  type: 'article' | 'news' | 'image' | 'video' | 'paper' | 'tool' | 'checklist';
  title: string;
  summary: string;
  source: string;
  url: string;
  thumbnailUrl?: string | null;
  relevance: number;
  whyShown: string;
  tags: string[];
  timestamp: string;
}

export interface ContextFeedState {
  enabled: boolean;
  items: ContextFeedItem[];
  pinnedItemIds: string[];
  activeTopic: string;
  lastUpdatedAt: string | null;
  isLoading: boolean;
}

// --- Automation Adapters ---

export interface AutomationTask {
  id: string;
  type: 'desktop' | 'browser' | 'server';
  status: 'pending' | 'running' | 'completed' | 'failed';
  logs: string[];
}

export interface GooseUltraComputerDriver {
  checkArmed(): boolean;
  runAction(action: 'CLICK' | 'TYPE' | 'SCREENSHOT', params: any): Promise<any>;
}

export interface GooseUltraBrowserDriver {
  navigate(url: string): Promise<void>;
  assert(selector: string): Promise<boolean>;
}

export interface GooseUltraServerDriver {
  connect(host: string): Promise<boolean>;
  runCommand(cmd: string, dryRun?: boolean): Promise<string>;
}

// --- Skills System ---

// --- Skills System (Strict Contract) ---

export type SkillPermission = 'network' | 'filesystem_read' | 'filesystem_write' | 'exec_powershell' | 'exec_shell' | 'ssh' | 'clipboard' | 'none';

export interface SkillManifest {
  id: string; // unique-slug
  name: string;
  description: string;
  category: string;
  version: string;
  author?: string;
  icon?: string; // name of icon
  inputsSchema: Record<string, any>; // JSON Schema
  outputsSchema: Record<string, any>; // JSON Schema
  entrypoint: {
    type: 'js_script' | 'python_script' | 'powershell' | 'api_call';
    uri: string; // relative path or command
    runtime_args?: string[];
  };
  permissions: SkillPermission[];
  examples?: { prompt: string; inputs: any }[];
  sourceUrl?: string; // Provenance
  commitHash?: string; // Provenance
}

export interface SkillRegistry {
  catalog: SkillManifest[]; // Available from upstream
  installed: SkillManifest[]; // Locally installed
  personaOverrides: Record<string, string[]>; // personaId -> enabledSkillIds
  lastUpdated: number;
}

export interface SkillRunRequest {
  runId: string;
  skillId: string;
  inputs: any;
  sessionId: string;
  context: {
    projectId: string;
    personaId: string;
    mode: string;
    messageId?: string;
  };
}

export interface SkillRunResult {
  runId: string;
  success: boolean;
  output: any;
  logs: string[];
  error?: string;
  durationMs: number;
}

// --- IT Expert Execution Agent ---

export interface ActionProposal {
  proposalId: string;
  persona: string;
  title: string;
  summary: string;
  risk: 'low' | 'medium' | 'high';
  steps: string[];
  runner: 'powershell' | 'ssh' | 'info';
  script: string;
  requiresApproval: boolean;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'rejected' | 'cancelled';
  target?: {
    host: string;
    port: number;
    user: string;
  } | null;
  timeoutMs?: number;
  result?: {
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
  };
}

export interface ExecutionSettings {
  localPowerShellEnabled: boolean;
  remoteSshEnabled: boolean;
  hasAcknowledgedRisk: boolean;
}
