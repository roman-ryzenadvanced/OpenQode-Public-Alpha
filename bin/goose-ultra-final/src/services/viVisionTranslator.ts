// Vi Vision Translator - Screenshot to JSON Translation Layer
// Converts visual state to machine-readable JSON for text-based LLMs
// Never sends raw images to text-only models

export interface VisualElement {
    role: 'button' | 'link' | 'input' | 'tab' | 'menu' | 'result' | 'text' | 'image' | 'unknown';
    label: string;
    bbox: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    centerX: number;
    centerY: number;
    confidence: number;
    attributes?: Record<string, string>;
}

export interface SearchResult {
    index: number;
    title: string;
    url: string;
    domain: string;
    snippet: string;
    bbox?: { x: number; y: number; w: number; h: number };
    isAd: boolean;
}

export interface VisualState {
    timestamp: string;
    viewport: {
        width: number;
        height: number;
    };
    pageInfo: {
        title: string;
        url: string;
        domain: string;
    };
    elements: VisualElement[];
    textBlocks: string[];
    searchResults: SearchResult[];
    hints: string[];
    focusedElement?: VisualElement;
}

// === DOM EXTRACTION (Primary Method) ===
// Uses browser automation to get accessibility tree / DOM

export function generateDOMExtractionScript(): string {
    return `
// Inject into browser to extract DOM state
(function() {
    const state = {
        timestamp: new Date().toISOString(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
        pageInfo: {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname
        },
        elements: [],
        textBlocks: [],
        searchResults: [],
        hints: []
    };
    
    // Extract clickable elements
    const clickables = document.querySelectorAll('a, button, input, [role="button"], [onclick]');
    clickables.forEach((el, idx) => {
        if (idx > 50) return; // Limit
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            state.elements.push({
                role: el.tagName.toLowerCase() === 'a' ? 'link' : 
                      el.tagName.toLowerCase() === 'button' ? 'button' :
                      el.tagName.toLowerCase() === 'input' ? 'input' : 'unknown',
                label: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().substring(0, 100),
                bbox: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                centerX: Math.round(rect.x + rect.width / 2),
                centerY: Math.round(rect.y + rect.height / 2),
                confidence: 0.9
            });
        }
    });
    
    // Extract Google search results specifically
    const googleResults = document.querySelectorAll('#search .g, #rso .g');
    googleResults.forEach((el, idx) => {
        if (idx > 10) return;
        const linkEl = el.querySelector('a[href]');
        const titleEl = el.querySelector('h3');
        const snippetEl = el.querySelector('.VwiC3b, .lEBKkf, [data-content-feature="1"]');
        
        if (linkEl && titleEl) {
            const href = linkEl.getAttribute('href') || '';
            const isAd = el.closest('[data-text-ad]') !== null || el.classList.contains('ads-ad');
            
            state.searchResults.push({
                index: idx,
                title: titleEl.textContent || '',
                url: href,
                domain: new URL(href, window.location.origin).hostname,
                snippet: snippetEl ? snippetEl.textContent || '' : '',
                isAd: isAd
            });
        }
    });
    
    // Detect page type
    if (window.location.hostname.includes('google.com')) {
        if (document.querySelector('#search, #rso')) {
            state.hints.push('GOOGLE_SEARCH_RESULTS_PAGE');
            state.hints.push('HAS_' + state.searchResults.length + '_RESULTS');
        } else if (document.querySelector('input[name="q"]')) {
            state.hints.push('GOOGLE_HOMEPAGE');
        }
    }
    
    // Get focused element
    if (document.activeElement && document.activeElement !== document.body) {
        const rect = document.activeElement.getBoundingClientRect();
        state.focusedElement = {
            role: 'input',
            label: document.activeElement.getAttribute('aria-label') || '',
            bbox: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
            centerX: rect.x + rect.width / 2,
            centerY: rect.y + rect.height / 2,
            confidence: 1.0
        };
    }
    
    return JSON.stringify(state, null, 2);
})();
    `;
}

// === OCR FALLBACK (When DOM not available) ===
// Uses Windows OCR to extract text and bounding boxes

export function generateOCRExtractionScript(): string {
    return `
# PowerShell script to capture screen and run OCR
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "SilentlyContinue"

# Take screenshot
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
$tempPath = "$env:TEMP\\vi_ocr_capture.bmp"
$bitmap.Save($tempPath)

$state = @{
    timestamp = (Get-Date).ToString("o")
    viewport = @{ width = $screen.Bounds.Width; height = $screen.Bounds.Height }
    pageInfo = @{ title = ""; url = ""; domain = "" }
    elements = @()
    textBlocks = @()
    searchResults = @()
    hints = @()
}

try {
    # Windows OCR
    Add-Type -AssemblyName 'Windows.Foundation, Version=255.255.255.255, Culture=neutral, PublicKeyToken=null, ContentType=WindowsRuntime'
    
    $ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    
    if ($ocrEngine) {
        $stream = [System.IO.File]::OpenRead($tempPath)
        $decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream.AsRandomAccessStream()).GetAwaiter().GetResult()
        $softwareBitmap = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()
        $ocrResult = $ocrEngine.RecognizeAsync($softwareBitmap).GetAwaiter().GetResult()
        
        foreach ($line in $ocrResult.Lines) {
            $lineText = ($line.Words | ForEach-Object { $_.Text }) -join " "
            $state.textBlocks += $lineText
            
            # Detect clickable-looking elements
            foreach ($word in $line.Words) {
                $rect = $word.BoundingRect
                $text = $word.Text
                
                # Heuristic: links often have http/www or look like domains
                if ($text -match "^https?:" -or $text -match "\\.com|\\.org|\\.net") {
                    $state.elements += @{
                        role = "link"
                        label = $text
                        bbox = @{ x = [int]$rect.X; y = [int]$rect.Y; w = [int]$rect.Width; h = [int]$rect.Height }
                        centerX = [int]($rect.X + $rect.Width / 2)
                        centerY = [int]($rect.Y + $rect.Height / 2)
                        confidence = 0.7
                    }
                }
            }
        }
        
        # Detect Google results page
        $fullText = $state.textBlocks -join " "
        if ($fullText -match "Google" -and $fullText -match "results|About|seconds") {
            $state.hints += "POSSIBLE_GOOGLE_RESULTS_PAGE"
        }
        
        $stream.Close()
    }
} catch {
    $state.hints += "OCR_ERROR: $($_.Exception.Message)"
}

$bitmap.Dispose()
$graphics.Dispose()

# Output as JSON
$state | ConvertTo-Json -Depth 5
    `;
}

// === AI ACTION PROMPT ===
// Generates strict prompt for LLM to decide next action

export interface AIActionRequest {
    task: string;
    currentPhase: string;
    currentStep: string;
    visualState: VisualState;
    history: { step: string; result: string }[];
}

export interface AIActionResponse {
    nextAction: {
        type: 'CLICK' | 'TYPE' | 'PRESS_KEY' | 'WAIT' | 'OPEN_URL' | 'STOP_AND_ASK_USER' | 'TASK_COMPLETE';
        selectorHint?: string;
        x?: number;
        y?: number;
        text?: string;
        key?: string;
        ms?: number;
        url?: string;
    };
    why: string;
    successCriteria: string[];
    selectedResult?: {
        index: number;
        title: string;
        reason: string;
    };
}

export function generateAIActionPrompt(request: AIActionRequest): string {
    const { task, currentPhase, currentStep, visualState, history } = request;

    return `You are Vi Agent, an AI controlling a computer to complete tasks.

TASK: ${task}
CURRENT PHASE: ${currentPhase}
CURRENT STEP: ${currentStep}

VISUAL STATE (what's on screen):
- Page: ${visualState.pageInfo.title} (${visualState.pageInfo.url})
- Viewport: ${visualState.viewport.width}x${visualState.viewport.height}
- Hints: ${visualState.hints.join(', ') || 'none'}

CLICKABLE ELEMENTS (${visualState.elements.length} found):
${visualState.elements.slice(0, 20).map((el, i) =>
        `  [${i}] ${el.role}: "${el.label.substring(0, 50)}" at (${el.centerX}, ${el.centerY})`
    ).join('\n')}

SEARCH RESULTS (${visualState.searchResults.length} found):
${visualState.searchResults.slice(0, 5).map((r, i) =>
        `  [${i}] ${r.isAd ? '[AD] ' : ''}${r.title}\n      URL: ${r.url}\n      Snippet: ${r.snippet.substring(0, 100)}...`
    ).join('\n\n')}

HISTORY:
${history.slice(-5).map(h => `  - ${h.step}: ${h.result}`).join('\n') || '  (none yet)'}

RESPOND WITH STRICT JSON ONLY - NO MARKDOWN FENCES:
{
    "nextAction": {
        "type": "CLICK" | "TYPE" | "PRESS_KEY" | "WAIT" | "TASK_COMPLETE" | "STOP_AND_ASK_USER",
        "x": <number if clicking>,
        "y": <number if clicking>,
        "text": "<string if typing>",
        "key": "<key name if pressing>",
        "ms": <milliseconds if waiting>
    },
    "why": "<1 sentence explanation>",
    "successCriteria": ["<observable condition>"],
    "selectedResult": {
        "index": <number if selecting a search result>,
        "title": "<result title>",
        "reason": "<why this result>"
    }
}

RULES:
1. If search results visible and task asks to open one: SELECT based on:
   - Prefer Wikipedia, reputable news, official sources
   - Avoid ads
   - Match relevance to query
   - Explain WHY in selectedResult.reason

2. CLICK coordinates must come from elements[] or searchResults[] bboxes

3. TYPE must only contain the exact text to type, NEVER instructions

4. Set TASK_COMPLETE only when objective truly achieved

5. Set STOP_AND_ASK_USER if stuck or unsure`;
}

// === RESPONSE PARSER ===
// Strict parser with retry logic

export function parseAIResponse(response: string): { success: boolean; action?: AIActionResponse; error?: string } {
    // Strip markdown code fences if present
    let cleaned = response
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    // Try to extract JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        return { success: false, error: 'No JSON object found in response' };
    }

    try {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate required fields
        if (!parsed.nextAction || !parsed.nextAction.type) {
            return { success: false, error: 'Missing nextAction.type' };
        }

        if (!parsed.why) {
            return { success: false, error: 'Missing why explanation' };
        }

        // Validate action type
        const validTypes = ['CLICK', 'TYPE', 'PRESS_KEY', 'WAIT', 'OPEN_URL', 'STOP_AND_ASK_USER', 'TASK_COMPLETE'];
        if (!validTypes.includes(parsed.nextAction.type)) {
            return { success: false, error: `Invalid action type: ${parsed.nextAction.type}` };
        }

        // Validate CLICK has coordinates
        if (parsed.nextAction.type === 'CLICK') {
            if (typeof parsed.nextAction.x !== 'number' || typeof parsed.nextAction.y !== 'number') {
                return { success: false, error: 'CLICK action missing x/y coordinates' };
            }
        }

        // Validate TYPE has text
        if (parsed.nextAction.type === 'TYPE' && !parsed.nextAction.text) {
            return { success: false, error: 'TYPE action missing text' };
        }

        return { success: true, action: parsed as AIActionResponse };
    } catch (e: any) {
        return { success: false, error: `JSON parse error: ${e.message}` };
    }
}

// === RESULT RANKER ===
// Applies rubric to search results

export function rankSearchResults(results: SearchResult[], criteria: string[]): SearchResult[] {
    const scored = results.map(result => {
        let score = 0;

        // Boost authoritative sources
        if (result.domain.includes('wikipedia.org')) score += 100;
        if (result.domain.includes('.gov')) score += 80;
        if (result.domain.includes('.edu')) score += 70;
        if (result.domain.includes('.org')) score += 30;

        // Boost reputable news
        const reputableNews = ['bbc.com', 'nytimes.com', 'reuters.com', 'theguardian.com', 'npr.org'];
        if (reputableNews.some(d => result.domain.includes(d))) score += 60;

        // Penalize ads heavily
        if (result.isAd) score -= 200;

        // Penalize low-quality domains
        const lowQuality = ['pinterest', 'quora', 'reddit.com'];
        if (lowQuality.some(d => result.domain.includes(d))) score -= 20;

        // Criteria-based adjustments
        if (criteria.includes('wikipedia') && result.domain.includes('wikipedia')) score += 100;
        if (criteria.includes('official') && (result.domain.includes('.gov') || result.title.toLowerCase().includes('official'))) score += 50;

        // Prefer results with longer snippets (more informative)
        score += Math.min(result.snippet.length / 10, 20);

        return { ...result, score };
    });

    return scored.sort((a, b) => (b as any).score - (a as any).score);
}

export default {
    generateDOMExtractionScript,
    generateOCRExtractionScript,
    generateAIActionPrompt,
    parseAIResponse,
    rankSearchResults
};
