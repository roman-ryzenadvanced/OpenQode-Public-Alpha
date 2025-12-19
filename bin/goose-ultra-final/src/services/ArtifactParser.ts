/**
 * ArtifactParser - Streaming Artifact Protocol (SAP) Parser
 * 
 * Parses LLM output that follows the Goose Artifact XML schema.
 * Ignores all conversational text outside tags.
 * 
 * Schema:
 * <goose_artifact id="...">
 *   <goose_file path="index.html">
 *     <![CDATA[ ...content... ]]>
 *   </goose_file>
 * </goose_artifact>
 */

export interface ParsedArtifact {
    id: string;
    files: Record<string, string>;
    actions: string[];
    thoughts: string[];
}

enum ParserState {
    IDLE = 'IDLE',
    IN_ARTIFACT = 'IN_ARTIFACT',
    IN_FILE = 'IN_FILE',
    IN_CDATA = 'IN_CDATA',
    IN_ACTION = 'IN_ACTION',
    IN_THOUGHT = 'IN_THOUGHT'
}

/**
 * State Machine Parser for Goose Artifact XML
 */
export class ArtifactStreamParser {
    private state: ParserState = ParserState.IDLE;
    private buffer: string = '';
    private currentFilePath: string = '';
    private currentFileContent: string = '';
    private artifact: ParsedArtifact = {
        id: '',
        files: {},
        actions: [],
        thoughts: []
    };

    /**
     * Parse a complete response string
     */
    public parse(input: string): ParsedArtifact {
        // Reset state
        this.reset();

        // Try XML-based parsing first
        const xmlResult = this.parseXML(input);
        if (xmlResult && Object.keys(xmlResult.files).length > 0) {
            return xmlResult;
        }

        // Fallback to legacy markdown parsing for backwards compatibility
        return this.parseLegacyMarkdown(input);
    }

    /**
     * Reset parser state
     */
    private reset(): void {
        this.state = ParserState.IDLE;
        this.buffer = '';
        this.currentFilePath = '';
        this.currentFileContent = '';
        this.artifact = {
            id: '',
            files: {},
            actions: [],
            thoughts: []
        };
    }

    /**
     * Parse XML-based artifact format
     */
    private parseXML(input: string): ParsedArtifact | null {
        // Extract artifact ID
        const artifactMatch = input.match(/<goose_artifact\s+id=["']([^"']+)["'][^>]*>/i);
        if (artifactMatch) {
            this.artifact.id = artifactMatch[1];
        }

        // Extract all files
        const fileRegex = /<goose_file\s+path=["']([^"']+)["'][^>]*>([\s\S]*?)<\/goose_file>/gi;
        let fileMatch;
        while ((fileMatch = fileRegex.exec(input)) !== null) {
            const filePath = fileMatch[1];
            let content = fileMatch[2];

            // Extract CDATA content if present
            const cdataMatch = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
            if (cdataMatch) {
                content = cdataMatch[1];
            }

            // Clean up the content
            content = content.trim();

            if (content) {
                this.artifact.files[filePath] = content;
            }
        }

        // Extract actions
        const actionRegex = /<goose_action\s+type=["']([^"']+)["'][^>]*>([\s\S]*?)<\/goose_action>/gi;
        let actionMatch;
        while ((actionMatch = actionRegex.exec(input)) !== null) {
            this.artifact.actions.push(`${actionMatch[1]}: ${actionMatch[2].trim()}`);
        }

        // Extract thoughts (for debugging/logging)
        const thoughtRegex = /<goose_thought>([\s\S]*?)<\/goose_thought>/gi;
        let thoughtMatch;
        while ((thoughtMatch = thoughtRegex.exec(input)) !== null) {
            this.artifact.thoughts.push(thoughtMatch[1].trim());
        }

        return this.artifact;
    }

    /**
     * Fallback parser for legacy markdown code blocks
     */
    private parseLegacyMarkdown(input: string): ParsedArtifact {
        const result: ParsedArtifact = {
            id: 'legacy-' + Date.now(),
            files: {},
            actions: [],
            thoughts: []
        };

        // Try to extract HTML from various patterns
        let htmlContent: string | null = null;

        // Pattern 1: ```html block
        const htmlBlockMatch = input.match(/```html\s*([\s\S]*?)```/i);
        if (htmlBlockMatch) {
            htmlContent = htmlBlockMatch[1].trim();
        }

        // Pattern 2: Any code block containing DOCTYPE or <html
        if (!htmlContent) {
            const genericBlockRegex = /```(?:\w*)?\s*([\s\S]*?)```/g;
            let match;
            while ((match = genericBlockRegex.exec(input)) !== null) {
                const content = match[1];
                if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
                    htmlContent = content.trim();
                    break;
                }
            }
        }

        // Pattern 3: Raw HTML (no code blocks) - find first DOCTYPE or <html
        if (!htmlContent) {
            const rawHtmlMatch = input.match(/(<!DOCTYPE html>[\s\S]*<\/html>)/i);
            if (rawHtmlMatch) {
                htmlContent = rawHtmlMatch[1].trim();
            }
        }

        // Pattern 4: Look for <html> without DOCTYPE
        if (!htmlContent) {
            const htmlTagMatch = input.match(/(<html[\s\S]*<\/html>)/i);
            if (htmlTagMatch) {
                htmlContent = '<!DOCTYPE html>\n' + htmlTagMatch[1].trim();
            }
        }

        if (htmlContent) {
            // Validate it looks like real HTML
            if (this.validateHTML(htmlContent)) {
                result.files['index.html'] = htmlContent;
            }
        }

        // Extract CSS if separate
        const cssMatch = input.match(/```css\s*([\s\S]*?)```/i);
        if (cssMatch && cssMatch[1].trim()) {
            result.files['style.css'] = cssMatch[1].trim();
        }

        // Extract JavaScript if separate
        const jsMatch = input.match(/```(?:javascript|js)\s*([\s\S]*?)```/i);
        if (jsMatch && jsMatch[1].trim()) {
            result.files['script.js'] = jsMatch[1].trim();
        }

        return result;
    }

    /**
     * Validate that content looks like real HTML
     */
    private validateHTML(content: string): boolean {
        // Must have basic HTML structure
        const hasDoctype = /<!DOCTYPE\s+html>/i.test(content);
        const hasHtmlTag = /<html/i.test(content);
        const hasBody = /<body/i.test(content);
        const hasClosingHtml = /<\/html>/i.test(content);

        // Check for common corruption patterns (visible raw code)
        const hasVisibleCode = /class=["'][^"']*["'].*class=["'][^"']*["']/i.test(content.replace(/<[^>]+>/g, ''));
        const hasEscapedHTML = /&lt;html/i.test(content);

        // Score the content
        let score = 0;
        if (hasDoctype) score += 2;
        if (hasHtmlTag) score += 2;
        if (hasBody) score += 1;
        if (hasClosingHtml) score += 1;
        if (hasVisibleCode) score -= 3;
        if (hasEscapedHTML) score -= 3;

        return score >= 3;
    }

    /**
     * Stream-friendly parsing - process chunks
     */
    public processChunk(chunk: string): void {
        this.buffer += chunk;
    }

    /**
     * Get current buffer for display
     */
    public getBuffer(): string {
        return this.buffer;
    }

    /**
     * Finalize and return parsed result
     */
    public finalize(): ParsedArtifact {
        return this.parse(this.buffer);
    }
}

// Singleton instance for convenience
export const artifactParser = new ArtifactStreamParser();

/**
 * Quick helper to extract files from LLM response
 */
export function extractArtifactFiles(response: string): Record<string, string> {
    const parser = new ArtifactStreamParser();
    const result = parser.parse(response);
    return result.files;
}

/**
 * Validate that a response contains valid artifacts
 */
export function validateArtifactResponse(response: string): {
    valid: boolean;
    hasXMLFormat: boolean;
    hasLegacyFormat: boolean;
    fileCount: number;
    errors: string[];
} {
    const errors: string[] = [];

    const hasXML = /<goose_file/i.test(response);
    const hasLegacy = /```html/i.test(response) || /<!DOCTYPE html>/i.test(response);

    const parser = new ArtifactStreamParser();
    const result = parser.parse(response);
    const fileCount = Object.keys(result.files).length;

    if (fileCount === 0) {
        errors.push('No valid files could be extracted');
    }

    if (!result.files['index.html']) {
        errors.push('Missing index.html - no entry point');
    }

    // Check for corruption in extracted HTML
    const html = result.files['index.html'] || '';
    if (html && !parser['validateHTML'](html)) {
        errors.push('Extracted HTML appears corrupted or incomplete');
    }

    return {
        valid: errors.length === 0,
        hasXMLFormat: hasXML,
        hasLegacyFormat: hasLegacy,
        fileCount,
        errors
    };
}
