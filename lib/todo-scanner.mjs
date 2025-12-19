/**
 * TodoScanner - Auto-scan TODO comments from project files (Vibe Upgrade)
 */

import fs from 'fs';
import path from 'path';

const TODO_PATTERNS = [
    /\/\/\s*TODO:?\s*(.+)/gi,       // JS/TS: // TODO
    /#\s*TODO:?\s*(.+)/gi,          // Python/Shell: # TODO
    /<!--\s*TODO:?\s*(.+?)-->/gi,   // HTML/MD: <!-- TODO -->
    /\/\*+\s*TODO:?\s*(.+?)\*+\//gi // C-style: /* TODO */
];

const SCAN_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.md', '.html', '.css', '.json'];

/**
 * Recursively scan directory for TODO comments
 * @param {string} rootPath - Root directory to scan
 * @param {number} maxFiles - Max files to scan (to prevent performance issues)
 * @returns {Array} - Array of { file, line, text }
 */
export async function scanTodos(rootPath, maxFiles = 100) {
    const todos = [];
    let filesScanned = 0;

    const scan = async (dir) => {
        if (filesScanned >= maxFiles) return;

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (filesScanned >= maxFiles) break;

                const fullPath = path.join(dir, entry.name);

                // Skip common ignored directories
                if (entry.isDirectory()) {
                    if (['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'vendor'].includes(entry.name)) {
                        continue;
                    }
                    await scan(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (SCAN_EXTENSIONS.includes(ext)) {
                        filesScanned++;
                        try {
                            const content = fs.readFileSync(fullPath, 'utf8');
                            const lines = content.split('\n');

                            lines.forEach((line, index) => {
                                for (const pattern of TODO_PATTERNS) {
                                    // Reset lastIndex for global patterns
                                    pattern.lastIndex = 0;
                                    const match = pattern.exec(line);
                                    if (match && match[1]) {
                                        todos.push({
                                            file: path.relative(rootPath, fullPath),
                                            line: index + 1,
                                            text: match[1].trim()
                                        });
                                    }
                                }
                            });
                        } catch (e) {
                            // Skip unreadable files
                        }
                    }
                }
            }
        } catch (e) {
            // Skip unreadable directories
        }
    };

    await scan(rootPath);
    return todos;
}

/**
 * Get formatted TODO display for Sidebar
 * @param {Array} todos - Array of { file, line, text }
 * @param {number} limit - Max items to display
 * @returns {string} - Formatted display string
 */
export function formatTodoDisplay(todos, limit = 5) {
    if (!todos || todos.length === 0) {
        return '📝 No TODOs found';
    }

    const display = todos.slice(0, limit).map(t => {
        const shortFile = t.file.length > 20 ? '...' + t.file.slice(-17) : t.file;
        const shortText = t.text.length > 30 ? t.text.slice(0, 27) + '...' : t.text;
        return `• ${shortFile}:${t.line}\n  ${shortText}`;
    }).join('\n');

    const remaining = todos.length > limit ? `\n... and ${todos.length - limit} more` : '';
    return display + remaining;
}

export default { scanTodos, formatTodoDisplay };
