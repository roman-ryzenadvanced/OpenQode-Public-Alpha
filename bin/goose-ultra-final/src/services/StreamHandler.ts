export interface StreamState {
    fullBuffer: string;
    isPublishing: boolean;
    artifactFound: boolean;
    sanitizedOutput: string;
}

export class SafeGenStreamer {
    private state: StreamState = {
        fullBuffer: "",
        isPublishing: false,
        artifactFound: false,
        sanitizedOutput: ""
    };

    /**
     * Processes a chunk from the LLM.
     * RETURNS: null (if unsafe/leaking) OR string (safe content to display)
     */
    processChunk(newChunk: string): string | null {
        // 1. Accumulate raw stream
        this.state.fullBuffer += newChunk;

        const buffer = this.state.fullBuffer;

        // 2. Safety Check: Tool Leakage
        // If we see raw tool calls, we hide them.
        if (buffer.includes("<<goose") || buffer.includes("goose_artifact")) {
            return "<!-- Forging Safe Artifact... -->";
        }

        // 3. JSON / Code Detection
        // We simply pass through the content now. The UI handles the "Matrix View".
        // We want the user to see the JSON being built.

        // Optional: formatting cleanup?
        // No, keep it raw for the "hacker" aesthetic requested.

        return buffer;
    }
}
