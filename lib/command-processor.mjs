/**
 * Command Processor - Handles slash commands for TUI 5
 * Integrates Session Memory, Skills, Debug Logger, etc.
 * 
 * Original implementation for OpenQode TUI
 */

import { getSessionMemory } from './session-memory.mjs';
import { getContextManager } from './context-manager.mjs';
import { getAllSkills, getSkill, executeSkill, getSkillListDisplay } from './skills.mjs';
import { getDebugLogger } from './debug-logger.mjs';

/**
 * Process a slash command
 * @param {string} input - User input
 * @returns {Object|null} - { handled: boolean, response: string, action?: string }
 */
export async function processCommand(input) {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
        return null; // Not a command
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (command) {
        // ═══════════════════════════════════════════════════════════════
        // SESSION MEMORY COMMANDS
        // ═══════════════════════════════════════════════════════════════
        case '/remember': {
            if (!args) {
                return {
                    handled: true,
                    response: '❌ Usage: /remember <fact to remember>\nExample: /remember User prefers TypeScript over JavaScript'
                };
            }
            const memory = getSessionMemory();
            await memory.load();
            const entry = await memory.remember(args);
            return {
                handled: true,
                response: `✅ Remembered: "${args}"\n📝 Fact #${memory.facts.length} saved to session memory.`
            };
        }

        case '/forget': {
            if (!args) {
                return {
                    handled: true,
                    response: '❌ Usage: /forget <number>\nExample: /forget 1'
                };
            }
            const memory = getSessionMemory();
            await memory.load();
            const index = parseInt(args, 10);
            const removed = await memory.forget(index);
            if (removed) {
                return {
                    handled: true,
                    response: `✅ Forgot fact #${index}: "${removed.fact}"`
                };
            }
            return {
                handled: true,
                response: `❌ Fact #${index} not found. Use /memory to see all facts.`
            };
        }

        case '/memory': {
            const memory = getSessionMemory();
            await memory.load();
            const facts = memory.getDisplayList();
            if (facts.length === 0) {
                return {
                    handled: true,
                    response: '📭 No facts in session memory.\nUse /remember <fact> to add one.'
                };
            }
            const list = facts.map(f => `${f.index}. [${f.category}] ${f.fact} (${f.displayDate})`).join('\n');
            return {
                handled: true,
                response: `📝 **Session Memory** (${facts.length} facts)\n\n${list}\n\nUse /forget <number> to remove a fact.`
            };
        }

        case '/clearmemory': {
            const memory = getSessionMemory();
            await memory.clear();
            return {
                handled: true,
                response: '🗑️ Session memory cleared.'
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // SKILLS COMMANDS
        // ═══════════════════════════════════════════════════════════════
        case '/skills': {
            const display = getSkillListDisplay();
            return {
                handled: true,
                response: `🎯 **Available Skills**\n${display}\nUsage: /skill <name> then describe your task`
            };
        }

        case '/skill': {
            if (!args) {
                const skills = getAllSkills();
                const names = skills.map(s => s.id).join(', ');
                return {
                    handled: true,
                    response: `❌ Usage: /skill <name>\nAvailable: ${names}`
                };
            }
            const skillName = args.split(/\s+/)[0];
            const skill = getSkill(skillName);
            if (!skill) {
                const skills = getAllSkills();
                const names = skills.map(s => s.id).join(', ');
                return {
                    handled: true,
                    response: `❌ Unknown skill: "${skillName}"\nAvailable: ${names}`
                };
            }
            return {
                handled: true,
                response: `🎯 **Activated: ${skill.name}**\n${skill.description}\n\nNow describe your task and I'll apply this skill.`,
                action: 'activate_skill',
                skill: skill
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // DEBUG COMMANDS
        // ═══════════════════════════════════════════════════════════════
        case '/debug': {
            const logger = getDebugLogger();
            const nowEnabled = logger.toggle();
            return {
                handled: true,
                response: nowEnabled
                    ? `🔧 Debug logging **ENABLED**\nLogs: ${logger.getPath()}`
                    : '🔧 Debug logging **DISABLED**'
            };
        }

        case '/debugclear': {
            const logger = getDebugLogger();
            await logger.clear();
            return {
                handled: true,
                response: '🗑️ Debug log cleared.'
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // CONTEXT COMMANDS
        // ═══════════════════════════════════════════════════════════════
        case '/context': {
            const ctx = getContextManager();
            // This will be enhanced when we have access to messages
            return {
                handled: true,
                response: `📊 **Context Manager**\nToken limit: ${ctx.tokenLimit.toLocaleString()}\nSummarize at: ${ctx.summarizeThreshold * 100}%\n\nContext will auto-summarize when usage exceeds threshold.`
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // HELP
        // ═══════════════════════════════════════════════════════════════
        case '/help': {
            return {
                handled: true,
                response: `📚 **Available Commands**

**Memory**
  /remember <fact>  - Save a fact to session memory
  /memory           - View all remembered facts
  /forget <#>       - Remove a fact by number
  /clearmemory      - Clear all memory

**Skills**
  /skills           - List available skills
  /skill <name>     - Activate a skill

**Debug**
  /debug            - Toggle debug logging
  /debugclear       - Clear debug log

**Context**
  /context          - View context usage stats

**Other**
  /help             - Show this help`
            };
        }

        default:
            return null; // Not a recognized command
    }
}

/**
 * Check if input is a command (starts with /)
 */
export function isCommand(input) {
    return input?.trim().startsWith('/');
}

export default { processCommand, isCommand };
