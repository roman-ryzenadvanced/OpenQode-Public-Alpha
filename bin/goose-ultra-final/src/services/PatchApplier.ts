/**
 * PatchApplier - Layer 3: Patch-Only Modifications
 * 
 * Instead of full regeneration, this module applies bounded patches
 * to existing HTML/CSS/JS files. Prevents redesign drift.
 * 
 * Patch Format:
 * {
 *   "patches": [
 *     { "op": "replace", "anchor": "<!-- HERO_SECTION -->", "content": "..." },
 *     { "op": "insert_after", "anchor": "</header>", "content": "..." },
 *     { "op": "delete", "anchor": "<!-- OLD_SECTION -->", "endAnchor": "<!-- /OLD_SECTION -->" }
 *   ]
 * }
 */

export interface Patch {
    op: 'replace' | 'insert_before' | 'insert_after' | 'delete';
    anchor: string;
    endAnchor?: string;  // For delete operations spanning multiple lines
    content?: string;    // For replace/insert operations
}

export interface PatchSet {
    patches: Patch[];
    targetFile?: string;  // Defaults to 'index.html'
}

export interface PatchResult {
    success: boolean;
    modifiedContent: string;
    appliedPatches: number;
    skippedPatches: number;
    errors: string[];
}

// Constraints
const MAX_LINES_PER_PATCH = 500;
const FORBIDDEN_ZONES = ['<!DOCTYPE', '<meta charset'];

/**
 * Check if user prompt indicates they want a full redesign
 */
export function checkRedesignIntent(prompt: string): boolean {
    const redesignKeywords = [
        'redesign',
        'rebuild from scratch',
        'start over',
        'completely new',
        'from the ground up',
        'total overhaul',
        'remake',
        'redo everything'
    ];

    const lowerPrompt = prompt.toLowerCase();
    return redesignKeywords.some(keyword => lowerPrompt.includes(keyword));
}

/**
 * Parse patch JSON from AI response
 */
export function parsePatchResponse(response: string): PatchSet | null {
    try {
        // Try to find JSON in the response
        const jsonMatch = response.match(/\{[\s\S]*"patches"[\s\S]*\}/);
        if (!jsonMatch) {
            // Try to find it in a code block
            const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*"patches"[\s\S]*\})\s*```/);
            if (codeBlockMatch) {
                return JSON.parse(codeBlockMatch[1]);
            }
            return null;
        }
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        console.error('[PatchApplier] Failed to parse patch JSON:', e);
        return null;
    }
}

/**
 * Validate a patch before applying
 */
function validatePatch(patch: Patch, content: string): { valid: boolean; error?: string } {
    // Check if anchor exists
    if (!content.includes(patch.anchor)) {
        return { valid: false, error: `Anchor not found: "${patch.anchor.substring(0, 50)}..."` };
    }

    // Check forbidden zones
    for (const zone of FORBIDDEN_ZONES) {
        if (patch.anchor.includes(zone) || patch.content?.includes(zone)) {
            return { valid: false, error: `Cannot modify forbidden zone: ${zone}` };
        }
    }

    // Check content size
    if (patch.content) {
        const lineCount = patch.content.split('\n').length;
        if (lineCount > MAX_LINES_PER_PATCH) {
            return { valid: false, error: `Patch content too large: ${lineCount} lines (max: ${MAX_LINES_PER_PATCH})` };
        }
    }

    return { valid: true };
}

/**
 * Apply a single patch to content
 */
function applySinglePatch(content: string, patch: Patch): { success: boolean; result: string; error?: string } {
    const validation = validatePatch(patch, content);
    if (!validation.valid) {
        return { success: false, result: content, error: validation.error };
    }

    switch (patch.op) {
        case 'replace':
            if (!patch.content) {
                return { success: false, result: content, error: 'Replace operation requires content' };
            }
            return { success: true, result: content.replace(patch.anchor, patch.content) };

        case 'insert_before':
            if (!patch.content) {
                return { success: false, result: content, error: 'Insert operation requires content' };
            }
            return { success: true, result: content.replace(patch.anchor, patch.content + patch.anchor) };

        case 'insert_after':
            if (!patch.content) {
                return { success: false, result: content, error: 'Insert operation requires content' };
            }
            return { success: true, result: content.replace(patch.anchor, patch.anchor + patch.content) };

        case 'delete':
            if (patch.endAnchor) {
                // Delete range between anchors
                const startIdx = content.indexOf(patch.anchor);
                const endIdx = content.indexOf(patch.endAnchor);
                if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
                    return { success: false, result: content, error: 'Invalid delete range' };
                }
                const before = content.substring(0, startIdx);
                const after = content.substring(endIdx + patch.endAnchor.length);
                return { success: true, result: before + after };
            } else {
                // Delete just the anchor
                return { success: true, result: content.replace(patch.anchor, '') };
            }

        default:
            return { success: false, result: content, error: `Unknown operation: ${patch.op}` };
    }
}

/**
 * Apply all patches to content
 */
export function applyPatches(content: string, patchSet: PatchSet): PatchResult {
    let modifiedContent = content;
    let appliedPatches = 0;
    let skippedPatches = 0;
    const errors: string[] = [];

    for (const patch of patchSet.patches) {
        const result = applySinglePatch(modifiedContent, patch);
        if (result.success) {
            modifiedContent = result.result;
            appliedPatches++;
        } else {
            skippedPatches++;
            errors.push(result.error || 'Unknown error');
        }
    }

    return {
        success: errors.length === 0,
        modifiedContent,
        appliedPatches,
        skippedPatches,
        errors
    };
}

/**
 * Generate a modification prompt that asks for patches instead of full code
 */
export function generatePatchPrompt(userRequest: string, existingHtml: string): string {
    // Extract key sections for context (first 2000 chars)
    const htmlContext = existingHtml.substring(0, 2000);

    return `You are modifying an EXISTING web application. DO NOT regenerate the entire file.
Output ONLY a JSON patch object with bounded changes.

PATCH FORMAT:
{
  "patches": [
    { "op": "replace", "anchor": "EXACT_TEXT_TO_FIND", "content": "NEW_CONTENT" },
    { "op": "insert_after", "anchor": "EXACT_TEXT_TO_FIND", "content": "CONTENT_TO_ADD" },
    { "op": "delete", "anchor": "START_TEXT", "endAnchor": "END_TEXT" }
  ]
}

RULES:
1. Each anchor must be a UNIQUE substring from the existing file
2. Maximum 500 lines per patch content
3. DO NOT modify <!DOCTYPE or <meta charset>
4. Return ONLY the JSON, no explanation

EXISTING FILE CONTEXT (truncated):
\`\`\`html
${htmlContext}
\`\`\`

USER REQUEST: ${userRequest}

OUTPUT (JSON only):`;
}
