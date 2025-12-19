/**
 * Vi Control - Complete Automation Backend
 * 
 * Credits:
 * - Inspired by CursorTouch/Windows-Use (MIT License)
 * - Inspired by browser-use/browser-use (MIT License)
 * - Uses native Windows APIs via PowerShell
 */

import { desktopCapturer, screen } from 'electron';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// ============================================
// SCREEN CAPTURE
// ============================================

/**
 * Capture the entire desktop or active window
 * @returns {Promise<{success: boolean, image: string, width: number, height: number}>}
 */
export async function captureScreen(mode = 'desktop') {
    try {
        const sources = await desktopCapturer.getSources({
            types: mode === 'window' ? ['window'] : ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        });

        if (sources.length === 0) {
            return { success: false, error: 'No screen sources found' };
        }

        // Get the primary source (first screen or active window)
        const source = sources[0];
        const thumbnail = source.thumbnail;

        // Convert to base64 data URL
        const imageDataUrl = thumbnail.toDataURL();

        return {
            success: true,
            image: imageDataUrl,
            width: thumbnail.getSize().width,
            height: thumbnail.getSize().height,
            sourceName: source.name
        };
    } catch (error) {
        console.error('[ViAutomation] Screen capture error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get list of available windows for capture
 */
export async function getWindowList() {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['window'],
            thumbnailSize: { width: 200, height: 150 }
        });

        return sources.map(s => ({
            id: s.id,
            name: s.name,
            thumbnail: s.thumbnail.toDataURL()
        }));
    } catch (error) {
        return [];
    }
}

// ============================================
// VISION ANALYSIS (Screenshot to JSON)
// ============================================

/**
 * Analyze screenshot using AI to extract UI elements
 * Since Qwen doesn't support images directly, we use a description approach
 */
export async function analyzeScreenshot(imageDataUrl, streamChat) {
    // For vision-to-JSON, we'll use a two-step approach:
    // 1. Describe what's in the image (using local vision or OCR)
    // 2. Send description to Qwen for structured analysis

    // First, let's try to extract text via PowerShell OCR (Windows 10+)
    const ocrResult = await extractTextFromImage(imageDataUrl);

    const systemPrompt = `You are a UI analysis expert. Given text extracted from a screenshot via OCR, analyze and describe:
1. What application/website is shown
2. Key UI elements (buttons, text fields, menus)
3. Current state of the interface
4. Possible actions a user could take

Output ONLY valid JSON in this format:
{
  "application": "string",
  "state": "string",
  "elements": [{"type": "button|input|text|menu|image", "label": "string", "position": "top|center|bottom"}],
  "possibleActions": ["string"],
  "summary": "string"
}`;

    const userPrompt = `OCR Text from screenshot:\n\n${ocrResult.text || '(No text detected)'}\n\nAnalyze this UI and provide structured JSON output.`;

    return new Promise((resolve) => {
        let fullResponse = '';

        streamChat(
            [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            'qwen-coder-plus',
            (chunk) => { fullResponse += chunk; },
            (complete) => {
                try {
                    // Try to parse JSON from response
                    const jsonMatch = complete.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        resolve({ success: true, analysis: JSON.parse(jsonMatch[0]), raw: complete });
                    } else {
                        resolve({ success: true, analysis: null, raw: complete });
                    }
                } catch (e) {
                    resolve({ success: true, analysis: null, raw: complete });
                }
            },
            (error) => {
                resolve({ success: false, error: error.message });
            },
            () => { }
        );
    });
}

/**
 * Extract text from image using Windows OCR
 */
async function extractTextFromImage(imageDataUrl) {
    try {
        // Save image temporarily
        const tempDir = path.join(os.tmpdir(), 'vi-control');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const imagePath = path.join(tempDir, `ocr_${Date.now()}.png`);
        const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(imagePath, Buffer.from(base64Data, 'base64'));

        // PowerShell OCR using Windows.Media.Ocr
        const psScript = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]

function Await($WinRtTask, $ResultType) {
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait()
    return $netTask.Result
}

$imagePath = '${imagePath.replace(/\\/g, '\\\\')}'
$stream = [System.IO.File]::OpenRead($imagePath)
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync([Windows.Storage.Streams.IRandomAccessStream]$stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$ocrResult = Await ($ocrEngine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$ocrResult.Text
$stream.Dispose()
`;

        const { stdout } = await execAsync(`powershell -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { timeout: 30000 });

        // Cleanup
        try { fs.unlinkSync(imagePath); } catch { }

        return { success: true, text: stdout.trim() };
    } catch (error) {
        console.error('[ViAutomation] OCR error:', error.message);
        return { success: false, text: '', error: error.message };
    }
}

// ============================================
// COMPUTER AUTOMATION (Mouse, Keyboard, Apps)
// ============================================

/**
 * Execute a natural language task by translating to automation commands
 */
export async function translateTaskToCommands(task, streamChat) {
    const systemPrompt = `You are a Windows automation expert. Given a user's natural language task, translate it into a sequence of automation commands.

Available commands:
- CLICK x,y - Click at screen coordinates
- TYPE "text" - Type text
- KEY "key" - Press a key (Enter, Tab, Escape, Win, etc.)
- HOTKEY "keys" - Press key combination (Ctrl+C, Alt+Tab, etc.)
- OPEN "app" - Open an application
- WAIT ms - Wait milliseconds
- POWERSHELL "script" - Run PowerShell command

Output ONLY a JSON array of commands:
[{"cmd": "OPEN", "value": "notepad"}, {"cmd": "WAIT", "value": "1000"}, {"cmd": "TYPE", "value": "Hello"}]`;

    return new Promise((resolve) => {
        let fullResponse = '';

        streamChat(
            [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Task: ${task}` }],
            'qwen-coder-plus',
            (chunk) => { fullResponse += chunk; },
            (complete) => {
                try {
                    const jsonMatch = complete.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        resolve({ success: true, commands: JSON.parse(jsonMatch[0]) });
                    } else {
                        resolve({ success: false, error: 'Could not parse commands', raw: complete });
                    }
                } catch (e) {
                    resolve({ success: false, error: e.message, raw: complete });
                }
            },
            (error) => resolve({ success: false, error: error.message }),
            () => { }
        );
    });
}

/**
 * Execute a single automation command
 */
export async function executeCommand(command) {
    const { cmd, value } = command;

    try {
        switch (cmd.toUpperCase()) {
            case 'CLICK': {
                const [x, y] = value.split(',').map(Number);
                await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y}); Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")]public static extern void mouse_event(int flags,int dx,int dy,int data,int info);' -Name U32 -Namespace W; [W.U32]::mouse_event(6,0,0,0,0)"`);
                return { success: true, cmd, value };
            }

            case 'TYPE': {
                await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${value.replace(/'/g, "''").replace(/[+^%~(){}[\]]/g, '{$&}')}')"`, { timeout: 10000 });
                return { success: true, cmd, value };
            }

            case 'KEY': {
                const keyMap = { Enter: '{ENTER}', Tab: '{TAB}', Escape: '{ESC}', Win: '^{ESC}', Backspace: '{BS}', Delete: '{DEL}' };
                const key = keyMap[value] || `{${value.toUpperCase()}}`;
                await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${key}')"`);
                return { success: true, cmd, value };
            }

            case 'HOTKEY': {
                // Convert Ctrl+C to ^c, Alt+Tab to %{TAB}
                let hotkey = value.replace(/Ctrl\+/gi, '^').replace(/Alt\+/gi, '%').replace(/Shift\+/gi, '+');
                await execAsync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${hotkey}')"`);
                return { success: true, cmd, value };
            }

            case 'OPEN': {
                await execAsync(`start "" "${value}"`, { shell: 'cmd.exe' });
                return { success: true, cmd, value };
            }

            case 'WAIT': {
                await new Promise(r => setTimeout(r, parseInt(value) || 1000));
                return { success: true, cmd, value };
            }

            case 'POWERSHELL': {
                const { stdout, stderr } = await execAsync(`powershell -ExecutionPolicy Bypass -Command "${value}"`, { timeout: 60000 });
                return { success: true, cmd, value, output: stdout || stderr };
            }

            default:
                return { success: false, error: `Unknown command: ${cmd}` };
        }
    } catch (error) {
        return { success: false, cmd, value, error: error.message };
    }
}

/**
 * Execute a chain of tasks with callbacks
 */
export async function executeTaskChain(tasks, streamChat, onProgress, onComplete) {
    const results = [];

    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        onProgress({ taskIndex: i, status: 'translating', task: task.task });

        // Translate natural language to commands
        const translation = await translateTaskToCommands(task.task, streamChat);

        if (!translation.success) {
            results.push({ task: task.task, success: false, error: translation.error });
            onProgress({ taskIndex: i, status: 'error', error: translation.error });
            continue;
        }

        onProgress({ taskIndex: i, status: 'executing', commands: translation.commands });

        // Execute each command
        for (const command of translation.commands) {
            const result = await executeCommand(command);
            if (!result.success) {
                results.push({ task: task.task, success: false, error: result.error, command });
                onProgress({ taskIndex: i, status: 'error', error: result.error, command });
                break;
            }
        }

        results.push({ task: task.task, success: true, commands: translation.commands });
        onProgress({ taskIndex: i, status: 'done' });
    }

    onComplete(results);
    return results;
}

// ============================================
// BROWSER AUTOMATION
// ============================================

/**
 * Open browser and navigate to URL
 */
export async function openBrowser(url) {
    try {
        await execAsync(`start "" "${url}"`, { shell: 'cmd.exe' });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Analyze current browser state (requires screenshot + vision)
 */
export async function analyzeBrowserPage(screenshotDataUrl, streamChat) {
    return analyzeScreenshot(screenshotDataUrl, streamChat);
}
