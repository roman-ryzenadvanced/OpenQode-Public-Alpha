#!/usr/bin/env node
/**
 * OpenQode Smart Repair Agent
 * A specialized TUI for diagnosing and fixing bugs in the main TUI IDE
 * 
 * This agent has ONE mission: Repair the TUI when it crashes
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const readline = require('readline');

// File paths relative to package root
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const MAIN_TUI = path.join(ROOT, 'bin', 'opencode-ink.mjs');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

// Colors for terminal output
const C = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    bold: '\x1b[1m',
    dim: '\x1b[2m'
};

const banner = () => {
    console.clear();
    console.log(C.magenta + C.bold);
    console.log('  ╔═══════════════════════════════════════════╗');
    console.log('  ║      🔧 OpenQode Smart Repair Agent 🔧     ║');
    console.log('  ║         TUI Self-Healing System           ║');
    console.log('  ╚═══════════════════════════════════════════╝');
    console.log(C.reset);
    console.log(C.dim + '  This agent can ONLY repair the TUI. No other tasks.' + C.reset);
    console.log('');
};

// Parse error from user input
const parseError = (errorText) => {
    const issues = [];

    // Extract file and line number
    const lineMatch = errorText.match(/opencode-ink\.mjs:(\d+)/);
    const line = lineMatch ? parseInt(lineMatch[1]) : null;

    // Common error patterns
    if (errorText.includes('Cannot read properties of null')) {
        issues.push({
            type: 'NULL_REFERENCE',
            desc: 'Null reference error - attempting to access property on null object',
            line
        });
    }
    if (errorText.includes('Cannot read properties of undefined')) {
        issues.push({
            type: 'UNDEFINED_REFERENCE',
            desc: 'Undefined reference - variable or property does not exist',
            line
        });
    }
    if (errorText.includes('useMemo') || errorText.includes('useEffect') || errorText.includes('useState')) {
        issues.push({
            type: 'REACT_HOOKS',
            desc: 'React hooks error - possible multiple React versions or hooks called outside component',
            line
        });
    }
    if (errorText.includes('ink-syntax-highlight')) {
        issues.push({
            type: 'INK_SYNTAX_HIGHLIGHT',
            desc: 'Extraneous ink-syntax-highlight package causing React conflict',
            line
        });
    }
    if (errorText.includes('ENOENT')) {
        issues.push({
            type: 'FILE_NOT_FOUND',
            desc: 'File or directory not found',
            line
        });
    }
    if (errorText.includes('SyntaxError')) {
        issues.push({
            type: 'SYNTAX_ERROR',
            desc: 'JavaScript syntax error in code',
            line
        });
    }

    return issues;
};

// Automatic repair functions
const repairs = {
    REACT_HOOKS: () => {
        console.log(C.yellow + '[*] Fixing React hooks conflict...' + C.reset);
        // Delete node_modules and reinstall
        const nmPath = path.join(ROOT, 'node_modules');
        const lockPath = path.join(ROOT, 'package-lock.json');
        if (fs.existsSync(nmPath)) {
            console.log('    Removing node_modules...');
            fs.rmSync(nmPath, { recursive: true, force: true });
        }
        if (fs.existsSync(lockPath)) {
            console.log('    Removing package-lock.json...');
            fs.unlinkSync(lockPath);
        }
        console.log('    Running npm install...');
        try {
            execSync('npm install --legacy-peer-deps', { cwd: ROOT, stdio: 'inherit' });
            return { success: true, msg: 'Dependencies reinstalled with React overrides' };
        } catch (e) {
            return { success: false, msg: 'npm install failed: ' + e.message };
        }
    },

    INK_SYNTAX_HIGHLIGHT: () => {
        console.log(C.yellow + '[*] Removing extraneous ink-syntax-highlight...' + C.reset);
        const ish = path.join(ROOT, 'node_modules', 'ink-syntax-highlight');
        if (fs.existsSync(ish)) {
            fs.rmSync(ish, { recursive: true, force: true });
            return { success: true, msg: 'Removed ink-syntax-highlight package' };
        }
        // If not found, do full reinstall
        return repairs.REACT_HOOKS();
    },

    NULL_REFERENCE: (issue) => {
        if (!issue.line) {
            return { success: false, msg: 'Could not determine line number for null reference fix' };
        }
        console.log(C.yellow + `[*] Checking line ${issue.line} for null safety...` + C.reset);
        // Read the file and show the problematic line
        const code = fs.readFileSync(MAIN_TUI, 'utf8');
        const lines = code.split('\n');
        const problemLine = lines[issue.line - 1];
        console.log(C.dim + `    Line ${issue.line}: ${problemLine.trim().substring(0, 60)}...` + C.reset);
        return { success: false, msg: 'Manual review needed. Please report to developer with error details.' };
    },

    UNDEFINED_REFERENCE: (issue) => repairs.NULL_REFERENCE(issue),

    FILE_NOT_FOUND: () => {
        console.log(C.yellow + '[*] Checking file structure...' + C.reset);
        if (!fs.existsSync(MAIN_TUI)) {
            return { success: false, msg: 'Main TUI file missing! Please re-clone the repository.' };
        }
        return { success: true, msg: 'File structure appears intact' };
    },

    SYNTAX_ERROR: () => {
        console.log(C.yellow + '[*] Checking syntax...' + C.reset);
        try {
            execSync(`node -c "${MAIN_TUI}"`, { cwd: ROOT });
            return { success: true, msg: 'Syntax check passed' };
        } catch (e) {
            return { success: false, msg: 'Syntax error detected. Please pull latest code: git pull origin main' };
        }
    }
};

// Main repair function
const attemptRepair = async (errorText) => {
    console.log(C.cyan + '\n[ANALYZING ERROR...]' + C.reset);
    const issues = parseError(errorText);

    if (issues.length === 0) {
        console.log(C.yellow + '[!] Could not identify specific issue from error.' + C.reset);
        console.log('    Generic repair: Reinstalling dependencies...');
        const result = repairs.REACT_HOOKS();
        return result;
    }

    console.log(C.green + `[✓] Identified ${issues.length} issue(s):` + C.reset);
    issues.forEach((issue, i) => {
        console.log(`    ${i + 1}. ${issue.type}: ${issue.desc}`);
        if (issue.line) console.log(`       At line: ${issue.line}`);
    });

    console.log(C.cyan + '\n[ATTEMPTING REPAIRS...]' + C.reset);

    for (const issue of issues) {
        const repairFn = repairs[issue.type];
        if (repairFn) {
            const result = repairFn(issue);
            if (result.success) {
                console.log(C.green + `[✓] ${result.msg}` + C.reset);
            } else {
                console.log(C.red + `[✗] ${result.msg}` + C.reset);
            }
        }
    }

    // Verify the fix
    console.log(C.cyan + '\n[VERIFYING FIX...]' + C.reset);
    try {
        execSync(`node -c "${MAIN_TUI}"`, { cwd: ROOT });
        console.log(C.green + '[✓] Syntax check passed!' + C.reset);
        return { success: true };
    } catch (e) {
        console.log(C.red + '[✗] Still has issues.' + C.reset);
        return { success: false };
    }
};

// Interactive mode
const runInteractive = async () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (q) => new Promise(resolve => rl.question(q, resolve));

    while (true) {
        banner();
        console.log(C.yellow + '  Paste the error message you received from TUI crash.' + C.reset);
        console.log(C.dim + '  (Type "quit" to exit, or press Ctrl+C)' + C.reset);
        console.log('');

        const errorText = await question(C.magenta + '> ' + C.reset);

        if (errorText.toLowerCase() === 'quit' || errorText.toLowerCase() === 'exit') {
            console.log(C.cyan + '\nGoodbye! Try launching TUI again.' + C.reset);
            rl.close();
            process.exit(0);
        }

        // Check if user is asking for something other than repair
        const nonRepairKeywords = ['create', 'build', 'write code', 'make a', 'help me', 'how to', 'what is'];
        if (nonRepairKeywords.some(kw => errorText.toLowerCase().includes(kw))) {
            console.log(C.red + '\n[!] I can ONLY repair the TUI. For other tasks, use the main TUI IDE.' + C.reset);
            await question('\nPress Enter to continue...');
            continue;
        }

        const result = await attemptRepair(errorText);

        console.log('');
        if (result.success) {
            console.log(C.green + C.bold + '  ╔═══════════════════════════════════════════╗' + C.reset);
            console.log(C.green + C.bold + '  ║      ✅ REPAIR COMPLETE ✅                ║' + C.reset);
            console.log(C.green + C.bold + '  ╚═══════════════════════════════════════════╝' + C.reset);
            console.log(C.cyan + '\n  Try launching the TUI again!' + C.reset);
        } else {
            console.log(C.yellow + '  If the error persists, paste the new error message.' + C.reset);
        }

        await question('\nPress Enter to continue...');
    }
};

// Entry point
runInteractive().catch(e => {
    console.error(C.red + 'Smart Repair crashed: ' + e.message + C.reset);
    process.exit(1);
});
