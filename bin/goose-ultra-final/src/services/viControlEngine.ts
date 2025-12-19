// Vi Control Engine - Complete Computer Use Implementation
// Credits: Inspired by Windows-Use, Open-Interface, browser-use, and opencode projects
// https://github.com/CursorTouch/Windows-Use
// https://github.com/AmberSahdev/Open-Interface
// https://github.com/browser-use/browser-use
// https://github.com/sst/opencode.git

export interface ViControlAction {
    type: 'mouse_click' | 'mouse_move' | 'keyboard_type' | 'keyboard_press' | 'screenshot' |
    'open_app' | 'open_url' | 'shell_command' | 'wait' | 'scroll' |
    'click_on_text' | 'find_text'; // Vision-based actions
    params: Record<string, any>;
    description?: string;
}

export interface ViControlTask {
    id: string;
    description: string;
    actions: ViControlAction[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    error?: string;
    output?: string[];
}

export interface ViControlSession {
    sessionId: string;
    tasks: ViControlTask[];
    currentTaskIndex: number;
    startedAt: number;
    completedAt?: number;
}

// PowerShell scripts for native Windows automation
export const POWERSHELL_SCRIPTS = {
    // Mouse control using C# interop
    mouseClick: (x: number, y: number, button: 'left' | 'right' = 'left') => `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MouseOps {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
    public const uint MOUSEEVENTF_LEFTDOWN = 0x02;
    public const uint MOUSEEVENTF_LEFTUP = 0x04;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x08;
    public const uint MOUSEEVENTF_RIGHTUP = 0x10;
    public static void Click(int x, int y, string button) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(50);
        if (button == "right") {
            mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
            mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
        } else {
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        }
    }
}
"@ -Language CSharp 2>$null
[MouseOps]::Click(${x}, ${y}, "${button}")
Write-Host "[Vi Control] Mouse ${button}-click at (${x}, ${y})"
    `,

    // Move mouse cursor
    mouseMove: (x: number, y: number) => `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseMove {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
}
"@
[MouseMove]::SetCursorPos(${x}, ${y})
Write-Host "[Vi Control] Mouse moved to (${x}, ${y})"
    `,

    // Keyboard typing using SendKeys
    keyboardType: (text: string) => `
Add-Type -AssemblyName System.Windows.Forms
# Escape special SendKeys characters
$text = "${text.replace(/[+^%~(){}[\]]/g, '{$&}')}"
[System.Windows.Forms.SendKeys]::SendWait($text)
Write-Host "[Vi Control] Typed: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"
    `,

    // Press special keys
    keyboardPress: (key: string) => {
        const keyMap: Record<string, string> = {
            'enter': '{ENTER}',
            'tab': '{TAB}',
            'escape': '{ESC}',
            'esc': '{ESC}',
            'backspace': '{BACKSPACE}',
            'delete': '{DELETE}',
            'up': '{UP}',
            'down': '{DOWN}',
            'left': '{LEFT}',
            'right': '{RIGHT}',
            'home': '{HOME}',
            'end': '{END}',
            'pageup': '{PGUP}',
            'pagedown': '{PGDN}',
            'f1': '{F1}', 'f2': '{F2}', 'f3': '{F3}', 'f4': '{F4}',
            'f5': '{F5}', 'f6': '{F6}', 'f7': '{F7}', 'f8': '{F8}',
            'f9': '{F9}', 'f10': '{F10}', 'f11': '{F11}', 'f12': '{F12}',
            'windows': '^{ESC}',
            'win': '^{ESC}',
            'start': '^{ESC}',
            'ctrl+c': '^c',
            'ctrl+v': '^v',
            'ctrl+a': '^a',
            'ctrl+s': '^s',
            'ctrl+z': '^z',
            'alt+tab': '%{TAB}',
            'alt+f4': '%{F4}',
        };
        const sendKey = keyMap[key.toLowerCase()] || `{${key.toUpperCase()}}`;
        return `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("${sendKey}")
Write-Host "[Vi Control] Pressed key: ${key}"
        `;
    },

    // Take screenshot and save to file
    screenshot: (filename?: string) => {
        const file = filename || `screenshot_${Date.now()}.png`;
        return `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
$savePath = "$env:TEMP\\${file}"
$bitmap.Save($savePath, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
$graphics.Dispose()
Write-Host "[Vi Control] Screenshot saved to: $savePath"
Write-Output $savePath
        `;
    },

    // Scroll mouse wheel
    scroll: (direction: 'up' | 'down', amount: number = 3) => `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseScroll {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
    public const uint MOUSEEVENTF_WHEEL = 0x0800;
}
"@
$delta = ${direction === 'up' ? amount * 120 : -amount * 120}
[MouseScroll]::mouse_event([MouseScroll]::MOUSEEVENTF_WHEEL, 0, 0, $delta, 0)
Write-Host "[Vi Control] Scrolled ${direction} by ${amount} lines"
    `,

    // Open application
    openApp: (appName: string) => `Start-Process ${appName}; Write-Host "[Vi Control] Opened: ${appName}"`,

    // Open URL in browser
    openUrl: (url: string) => `Start-Process "${url}"; Write-Host "[Vi Control] Opened URL: ${url}"`,

    // Wait/delay
    wait: (ms: number) => `Start-Sleep -Milliseconds ${ms}; Write-Host "[Vi Control] Waited ${ms}ms"`,

    // Get active window info
    getActiveWindow: () => `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class ActiveWindow {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    public static string GetTitle() {
        IntPtr hwnd = GetForegroundWindow();
        StringBuilder sb = new StringBuilder(256);
        GetWindowText(hwnd, sb, 256);
        return sb.ToString();
    }
}
"@
$title = [ActiveWindow]::GetTitle()
Write-Host "[Vi Control] Active window: $title"
Write-Output $title
    `,

    // Find window and bring to front
    focusWindow: (titlePart: string) => `
$process = Get-Process | Where-Object { $_.MainWindowTitle -like "*${titlePart}*" } | Select-Object -First 1
if ($process) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinFocus {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
    [WinFocus]::SetForegroundWindow($process.MainWindowHandle)
    Write-Host "[Vi Control] Focused window: $($process.MainWindowTitle)"
} else {
    Write-Host "[Vi Control] Window not found: ${titlePart}"
}
    `,
};

// Parse natural language into a chain of actions
export function parseNaturalLanguageToActions(input: string): ViControlAction[] {
    const actions: ViControlAction[] = [];
    const lower = input.toLowerCase().trim();

    // First, check for "search for X" suffix in the entire command (before splitting)
    // Pattern: "go to google.com and search for RED" should become: open URL + wait + type + enter
    const globalSearchMatch = lower.match(/(.+?)\s+(?:and\s+)?search\s+(?:for\s+)?["']?([^"']+)["']?$/i);

    if (globalSearchMatch) {
        // Process the part before "search for"
        const beforeSearch = globalSearchMatch[1].trim();
        const searchTerm = globalSearchMatch[2].trim();

        // Parse the beforeSearch part 
        const beforeActions = parseSteps(beforeSearch);
        actions.push(...beforeActions);

        // Add wait for page to load
        actions.push({
            type: 'wait',
            params: { ms: 2000 },
            description: 'Wait for page to load'
        });

        // Add the search actions (type + enter)
        actions.push({
            type: 'keyboard_type',
            params: { text: searchTerm },
            description: `Type: ${searchTerm}`
        });
        actions.push({
            type: 'keyboard_press',
            params: { key: 'enter' },
            description: 'Press Enter to search'
        });

        return actions;
    }

    // Split by common conjunctions for chain of tasks
    const steps = lower.split(/[,;]\s*|\s+(?:then|and then|after that|next|also|finally|and)\s+/i).filter(Boolean);

    for (const step of steps) {
        const stepActions = parseSteps(step.trim());
        actions.push(...stepActions);
    }

    return actions;
}

// Helper function to parse a single step
function parseSteps(stepTrimmed: string): ViControlAction[] {
    const actions: ViControlAction[] = [];
    if (!stepTrimmed) return actions;

    // Open Start Menu / Windows Key
    if (stepTrimmed.match(/(?:press|open|click)\s*(?:the\s+)?(?:start\s*menu|windows\s*key|start)/i)) {
        actions.push({
            type: 'keyboard_press',
            params: { key: 'windows' },
            description: 'Open Start Menu'
        });
        return actions;
    }

    // Open URL / Go to website
    const urlMatch = stepTrimmed.match(/(?:go\s+to|open|navigate\s+to|browse\s+to|visit)\s+(\S+\.(?:com|org|net|io|dev|co|ai|gov|edu|me|app)\S*)/i);
    if (urlMatch) {
        let url = urlMatch[1];
        if (!url.startsWith('http')) url = 'https://' + url;
        actions.push({
            type: 'open_url',
            params: { url },
            description: `Open ${url}`
        });
        return actions;
    }

    // Open application
    const appPatterns: { pattern: RegExp; app: string }[] = [
        { pattern: /open\s+notepad/i, app: 'notepad' },
        { pattern: /open\s+calculator/i, app: 'calc' },
        { pattern: /open\s+file\s*explorer/i, app: 'explorer' },
        { pattern: /open\s+chrome/i, app: 'chrome' },
        { pattern: /open\s+firefox/i, app: 'firefox' },
        { pattern: /open\s+edge/i, app: 'msedge' },
        { pattern: /open\s+cmd|open\s+command\s*prompt/i, app: 'cmd' },
        { pattern: /open\s+powershell/i, app: 'powershell' },
        { pattern: /open\s+settings/i, app: 'ms-settings:' },
        { pattern: /open\s+task\s*manager/i, app: 'taskmgr' },
        { pattern: /open\s+paint/i, app: 'mspaint' },
        { pattern: /open\s+word/i, app: 'winword' },
        { pattern: /open\s+excel/i, app: 'excel' },
        { pattern: /open\s+vscode|open\s+vs\s*code/i, app: 'code' },
    ];

    for (const { pattern, app } of appPatterns) {
        if (pattern.test(stepTrimmed)) {
            actions.push({
                type: 'open_app',
                params: { app },
                description: `Open ${app}`
            });
            return actions;
        }
    }

    // Vision: Click on text element (e.g., "click on Submit button", "click on Settings")
    const clickOnTextMatch = stepTrimmed.match(/click\s+(?:on\s+)?(?:the\s+)?["']?([^"']+?)["']?(?:\s+button|\s+link|\s+text)?$/i);
    if (clickOnTextMatch && !stepTrimmed.match(/\d+\s*[,x]\s*\d+/)) {
        // Only if no coordinates are specified
        actions.push({
            type: 'click_on_text',
            params: { text: clickOnTextMatch[1].trim() },
            description: `Click on "${clickOnTextMatch[1].trim()}"`
        });
        return actions;
    }

    // Vision: Find text on screen
    const findTextMatch = stepTrimmed.match(/find\s+(?:the\s+)?["']?([^"']+?)["']?(?:\s+on\s+screen)?$/i);
    if (findTextMatch) {
        actions.push({
            type: 'find_text',
            params: { text: findTextMatch[1].trim() },
            description: `Find "${findTextMatch[1].trim()}" on screen`
        });
        return actions;
    }

    // Click at coordinates
    const clickMatch = stepTrimmed.match(/click\s+(?:at\s+)?(?:\()?(\d+)\s*[,x]\s*(\d+)(?:\))?/i);
    if (clickMatch) {
        actions.push({
            type: 'mouse_click',
            params: { x: parseInt(clickMatch[1]), y: parseInt(clickMatch[2]), button: 'left' },
            description: `Click at (${clickMatch[1]}, ${clickMatch[2]})`
        });
        return actions;
    }

    // Right click
    const rightClickMatch = stepTrimmed.match(/right\s*click\s+(?:at\s+)?(?:\()?(\d+)\s*[,x]\s*(\d+)(?:\))?/i);
    if (rightClickMatch) {
        actions.push({
            type: 'mouse_click',
            params: { x: parseInt(rightClickMatch[1]), y: parseInt(rightClickMatch[2]), button: 'right' },
            description: `Right-click at (${rightClickMatch[1]}, ${rightClickMatch[2]})`
        });
        return actions;
    }

    // Type text
    const typeMatch = stepTrimmed.match(/(?:type|enter|write|input)\s+["']?(.+?)["']?$/i);
    if (typeMatch) {
        actions.push({
            type: 'keyboard_type',
            params: { text: typeMatch[1] },
            description: `Type: ${typeMatch[1].substring(0, 30)}...`
        });
        return actions;
    }

    // Search for something (type + enter)
    const searchMatch = stepTrimmed.match(/search\s+(?:for\s+)?["']?(.+?)["']?$/i);
    if (searchMatch) {
        actions.push({
            type: 'keyboard_type',
            params: { text: searchMatch[1] },
            description: `Search for: ${searchMatch[1]}`
        });
        actions.push({
            type: 'keyboard_press',
            params: { key: 'enter' },
            description: 'Press Enter'
        });
        return actions;
    }

    // Press key
    const pressMatch = stepTrimmed.match(/press\s+(?:the\s+)?(\w+(?:\+\w+)?)/i);
    if (pressMatch && !stepTrimmed.includes('start')) {
        actions.push({
            type: 'keyboard_press',
            params: { key: pressMatch[1] },
            description: `Press ${pressMatch[1]}`
        });
        return actions;
    }

    // Take screenshot
    if (stepTrimmed.match(/(?:take\s+(?:a\s+)?)?screenshot/i)) {
        actions.push({
            type: 'screenshot',
            params: {},
            description: 'Take screenshot'
        });
        return actions;
    }

    // Wait
    const waitMatch = stepTrimmed.match(/wait\s+(?:for\s+)?(\d+)\s*(?:ms|milliseconds?|s|seconds?)?/i);
    if (waitMatch) {
        let ms = parseInt(waitMatch[1]);
        if (stepTrimmed.includes('second')) ms *= 1000;
        actions.push({
            type: 'wait',
            params: { ms },
            description: `Wait ${ms}ms`
        });
        return actions;
    }

    // Scroll
    const scrollMatch = stepTrimmed.match(/scroll\s+(up|down)(?:\s+(\d+))?/i);
    if (scrollMatch) {
        actions.push({
            type: 'scroll',
            params: { direction: scrollMatch[1].toLowerCase(), amount: parseInt(scrollMatch[2]) || 3 },
            description: `Scroll ${scrollMatch[1]}`
        });
        return actions;
    }

    // If nothing matched, treat as shell command
    actions.push({
        type: 'shell_command',
        params: { command: stepTrimmed },
        description: `Execute: ${stepTrimmed.substring(0, 50)}...`
    });

    return actions;
}

// Convert action to PowerShell command
export function actionToPowerShell(action: ViControlAction): string {
    switch (action.type) {
        case 'mouse_click':
            return POWERSHELL_SCRIPTS.mouseClick(
                action.params.x,
                action.params.y,
                action.params.button || 'left'
            );
        case 'mouse_move':
            return POWERSHELL_SCRIPTS.mouseMove(action.params.x, action.params.y);
        case 'keyboard_type':
            return POWERSHELL_SCRIPTS.keyboardType(action.params.text);
        case 'keyboard_press':
            return POWERSHELL_SCRIPTS.keyboardPress(action.params.key);
        case 'screenshot':
            return POWERSHELL_SCRIPTS.screenshot(action.params.filename);
        case 'open_app':
            return POWERSHELL_SCRIPTS.openApp(action.params.app);
        case 'open_url':
            return POWERSHELL_SCRIPTS.openUrl(action.params.url);
        case 'wait':
            return POWERSHELL_SCRIPTS.wait(action.params.ms);
        case 'scroll':
            return POWERSHELL_SCRIPTS.scroll(action.params.direction, action.params.amount);
        case 'shell_command':
            return action.params.command;
        // Vision-based actions (using Windows OCR)
        case 'click_on_text':
            return clickOnTextScript(action.params.text);
        case 'find_text':
            return findElementByTextScript(action.params.text);
        default:
            return `Write-Host "[Vi Control] Unknown action type: ${action.type}"`;
    }
}

// Execute a chain of actions
export async function executeViControlChain(
    actions: ViControlAction[],
    onActionStart?: (action: ViControlAction, index: number) => void,
    onActionComplete?: (action: ViControlAction, index: number, output: string) => void,
    onError?: (action: ViControlAction, index: number, error: string) => void
): Promise<boolean> {
    const electron = (window as any).electron;

    if (!electron?.runPowerShell) {
        console.warn('[Vi Control] No Electron PowerShell bridge available');
        return false;
    }

    for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        onActionStart?.(action, i);

        const script = actionToPowerShell(action);
        const sessionId = `vi-${Date.now()}-${i}`;

        try {
            await new Promise<string>((resolve, reject) => {
                let output = '';

                electron.removeExecListeners?.();

                electron.onExecChunk?.(({ text }: any) => {
                    output += text + '\n';
                });

                electron.onExecComplete?.(() => {
                    resolve(output);
                });

                electron.onExecError?.(({ message }: any) => {
                    reject(new Error(message));
                });

                electron.runPowerShell(sessionId, script, true);

                // Timeout after 30 seconds
                setTimeout(() => resolve(output), 30000);
            }).then((output) => {
                onActionComplete?.(action, i, output);
            });
        } catch (error: any) {
            onError?.(action, i, error.message || 'Unknown error');
            return false; // Stop chain on error
        }

        // Small delay between actions for stability
        if (i < actions.length - 1) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return true;
}

// Get screen resolution
export function getScreenResolutionScript(): string {
    return `
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
Write-Host "Width: $($screen.Bounds.Width)"
Write-Host "Height: $($screen.Bounds.Height)"
    `;
}

// === VISION CONTROL ===
// Uses Windows built-in OCR via UWP APIs

// Take screenshot and perform OCR using Windows.Media.Ocr
export function screenshotWithOcrScript(): string {
    return `
# Capture screenshot
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
$tempPath = "$env:TEMP\\vi_control_screenshot.png"
$bitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
$graphics.Dispose()
Write-Host "[Vi Control] Screenshot captured: $tempPath"
Write-Output $tempPath
    `;
}

// Find element coordinates using Windows OCR (PowerShell 5+ with UWP)
export function findElementByTextScript(searchText: string): string {
    return `
# Windows OCR via UWP
$ErrorActionPreference = "SilentlyContinue"

# Take screenshot first
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
$tempPath = "$env:TEMP\\vi_ocr_temp.bmp"
$bitmap.Save($tempPath)

try {
    # Load Windows Runtime OCR
    Add-Type -AssemblyName 'Windows.Foundation, Version=255.255.255.255, Culture=neutral, PublicKeyToken=null, ContentType=WindowsRuntime'
    Add-Type -AssemblyName 'Windows.Graphics, Version=255.255.255.255, Culture=neutral, PublicKeyToken=null, ContentType=WindowsRuntime'
    
    # Use Windows.Media.Ocr.OcrEngine
    [Windows.Foundation.IAsyncOperation[Windows.Media.Ocr.OcrResult]]$asyncOp = $null
    $ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    
    if ($ocrEngine) {
        # Load image for OCR
        $stream = [System.IO.File]::OpenRead($tempPath)
        $decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream.AsRandomAccessStream()).GetAwaiter().GetResult()
        $softwareBitmap = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()
        
        # Perform OCR
        $ocrResult = $ocrEngine.RecognizeAsync($softwareBitmap).GetAwaiter().GetResult()
        
        $searchLower = "${searchText}".ToLower()
        $found = $false
        
        foreach ($line in $ocrResult.Lines) {
            foreach ($word in $line.Words) {
                if ($word.Text.ToLower().Contains($searchLower)) {
                    $rect = $word.BoundingRect
                    $centerX = [int]($rect.X + $rect.Width / 2)
                    $centerY = [int]($rect.Y + $rect.Height / 2)
                    Write-Host "[Vi Control] Found '$($word.Text)' at coordinates: ($centerX, $centerY)"
                    Write-Host "COORDINATES:$centerX,$centerY"
                    $found = $true
                    break
                }
            }
            if ($found) { break }
        }
        
        if (-not $found) {
            Write-Host "[Vi Control] Text '${searchText}' not found on screen"
            Write-Host "COORDINATES:NOT_FOUND"
        }
        
        $stream.Close()
    } else {
        Write-Host "[Vi Control] OCR engine not available"
        Write-Host "COORDINATES:OCR_UNAVAILABLE"
    }
} catch {
    Write-Host "[Vi Control] OCR error: $($_.Exception.Message)"
    Write-Host "COORDINATES:ERROR"
}

$bitmap.Dispose()
$graphics.Dispose()
    `;
}

// Click on element found by text (combines OCR + click)
export function clickOnTextScript(searchText: string): string {
    return `
# Find and click on text element
${findElementByTextScript(searchText)}

# Parse coordinates and click
$coordLine = $output | Select-String "COORDINATES:" | Select-Object -Last 1
if ($coordLine) {
    $coords = $coordLine.ToString().Split(':')[1]
    if ($coords -ne "NOT_FOUND" -and $coords -ne "ERROR" -and $coords -ne "OCR_UNAVAILABLE") {
        $parts = $coords.Split(',')
        $x = [int]$parts[0]
        $y = [int]$parts[1]
        
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class VisionClick {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(100);
        mouse_event(0x02, 0, 0, 0, 0); // LEFTDOWN
        mouse_event(0x04, 0, 0, 0, 0); // LEFTUP
    }
}
"@
        [VisionClick]::Click($x, $y)
        Write-Host "[Vi Control] Clicked on '${searchText}' at ($x, $y)"
    }
}
    `;
}

// Vision-based action: find and interact with UI elements
export interface VisionAction {
    type: 'find_text' | 'click_text' | 'find_button' | 'click_button' | 'read_screen';
    target?: string;
}

export function visionActionToPowerShell(action: VisionAction): string {
    switch (action.type) {
        case 'find_text':
            return findElementByTextScript(action.target || '');
        case 'click_text':
            return clickOnTextScript(action.target || '');
        case 'read_screen':
            return screenshotWithOcrScript();
        default:
            return `Write-Host "[Vi Control] Unknown vision action: ${action.type}"`;
    }
}

