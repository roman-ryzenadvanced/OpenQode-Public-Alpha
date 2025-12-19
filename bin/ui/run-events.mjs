/**
 * Run Events Model - Append-only event stream with strict channel routing
 * 
 * CORE DATA MODEL:
 * - Run: tracks automation state
 * - RunEvent: append-only stream with type-based routing
 * 
 * Credits: sst/opencode session model, Windows-Use verification loop
 */

// Run states
export const RUN_STATE = {
    IDLE: 'idle',
    ASKING: 'asking',
    PREVIEWING: 'previewing',
    RUNNING: 'running',
    VERIFYING: 'verifying',
    DONE: 'done',
    FAILED: 'failed',
    BLOCKED: 'blocked'  // needs human intervention
};

// Event types with strict channel routing
export const EVENT_TYPES = {
    // CHAT lane (user sees these as conversation)
    CHAT_USER: 'chat_user',
    CHAT_ASSISTANT: 'chat_assistant',

    // AUTOMATION lane (collapsed by default)
    OBSERVE_SNAPSHOT: 'observe_snapshot',
    INTENT_TRACE: 'intent_trace',
    PREVIEW_PLAN: 'preview_plan',
    ACTION_BATCH: 'action_batch',
    ACTION_RESULT: 'action_result',
    VERIFICATION: 'verification',

    // TOOL lane (hidden by default)
    TOOL_SUMMARY: 'tool_summary',
    TOOL_DETAILS: 'tool_details',

    // ARTIFACT lane (clickable items)
    ARTIFACT: 'artifact',
    TODO_UPDATE: 'todo_update',

    // TOAST (ephemeral, not in transcript)
    TOAST: 'toast',

    // ERROR (collapsed by default)
    ERROR: 'error'
};

// Channel routing map
export const CHANNEL_MAP = {
    [EVENT_TYPES.CHAT_USER]: 'chat',
    [EVENT_TYPES.CHAT_ASSISTANT]: 'chat',
    [EVENT_TYPES.OBSERVE_SNAPSHOT]: 'automation',
    [EVENT_TYPES.INTENT_TRACE]: 'automation',
    [EVENT_TYPES.PREVIEW_PLAN]: 'automation',
    [EVENT_TYPES.ACTION_BATCH]: 'automation',
    [EVENT_TYPES.ACTION_RESULT]: 'automation',
    [EVENT_TYPES.VERIFICATION]: 'automation',
    [EVENT_TYPES.TOOL_SUMMARY]: 'tool',
    [EVENT_TYPES.TOOL_DETAILS]: 'tool',
    [EVENT_TYPES.ARTIFACT]: 'artifact',
    [EVENT_TYPES.TODO_UPDATE]: 'artifact',
    [EVENT_TYPES.TOAST]: 'toast',
    [EVENT_TYPES.ERROR]: 'error'
};

/**
 * Create a new Run
 */
export function createRun(goal, mode = 'chat') {
    return {
        runId: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        mode,                   // 'chat' | 'desktop' | 'browser' | 'server'
        goal,
        state: RUN_STATE.ASKING,
        stepIndex: 0,
        maxSteps: 25,
        failureCount: 0,
        maxFailures: 3,
        activeTarget: null,
        confidence: 1.0,
        events: [],
        createdAt: Date.now()
    };
}

/**
 * Create a RunEvent
 */
export function createEvent(type, payload) {
    if (!EVENT_TYPES[type] && !Object.values(EVENT_TYPES).includes(type)) {
        console.warn(`Unknown event type: ${type}`);
    }

    return {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
        type,
        channel: CHANNEL_MAP[type] || 'tool',
        payload,
        timestamp: Date.now()
    };
}

/**
 * Append event to run (immutable)
 */
export function appendEvent(run, event) {
    return {
        ...run,
        events: [...run.events, event]
    };
}

/**
 * Update run state
 */
export function updateRunState(run, newState, updates = {}) {
    return {
        ...run,
        state: newState,
        ...updates
    };
}

/**
 * Get events by channel
 */
export function getEventsByChannel(run, channel) {
    return run.events.filter(e => e.channel === channel);
}

/**
 * Get chat events only (for CHAT lane)
 */
export function getChatEvents(run) {
    return getEventsByChannel(run, 'chat');
}

/**
 * Get automation events (for timeline)
 */
export function getAutomationEvents(run) {
    return getEventsByChannel(run, 'automation');
}

/**
 * Check if run needs human intervention
 */
export function isBlocked(run) {
    return run.state === RUN_STATE.BLOCKED;
}

/**
 * Check if run is complete
 */
export function isComplete(run) {
    return run.state === RUN_STATE.DONE || run.state === RUN_STATE.FAILED;
}

/**
 * Record a verification result
 */
export function createVerification(passed, expected, observed, message = null) {
    return createEvent(EVENT_TYPES.VERIFICATION, {
        passed,
        expected,
        observed,
        message
    });
}

/**
 * Record an observation snapshot
 */
export function createObservation(snapshotData, snapshotType = 'desktop') {
    return createEvent(EVENT_TYPES.OBSERVE_SNAPSHOT, {
        type: snapshotType,
        data: snapshotData,
        timestamp: Date.now()
    });
}

/**
 * Create a toast event (for confirmations)
 */
export function createToast(message, type = 'info') {
    return createEvent(EVENT_TYPES.TOAST, {
        message,
        type  // 'info' | 'success' | 'warning' | 'error'
    });
}

export default {
    RUN_STATE,
    EVENT_TYPES,
    CHANNEL_MAP,
    createRun,
    createEvent,
    appendEvent,
    updateRunState,
    getEventsByChannel,
    getChatEvents,
    getAutomationEvents,
    isBlocked,
    isComplete,
    createVerification,
    createObservation,
    createToast
};
