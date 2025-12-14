/**
 * Session Memory - Persistent context storage for TUI 5
 * Allows AI to remember important facts across sessions
 * 
 * Original implementation for OpenQode TUI
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const MEMORY_FILE = '.openqode-memory.json';

/**
 * SessionMemory class - Manages persistent facts/context across TUI sessions
 */
export class SessionMemory {
    constructor(projectPath = null) {
        this.projectPath = projectPath || process.cwd();
        this.memoryPath = join(this.projectPath, MEMORY_FILE);
        this.facts = [];
        this.metadata = {
            created: null,
            lastModified: null,
            version: '1.0'
        };
    }

    /**
     * Load memory from disk
     */
    async load() {
        try {
            await access(this.memoryPath);
            const data = await readFile(this.memoryPath, 'utf8');
            const parsed = JSON.parse(data);
            this.facts = parsed.facts || [];
            this.metadata = parsed.metadata || this.metadata;
            return true;
        } catch (error) {
            // No memory file exists yet - that's OK
            this.facts = [];
            this.metadata.created = new Date().toISOString();
            return false;
        }
    }

    /**
     * Save memory to disk
     */
    async save() {
        this.metadata.lastModified = new Date().toISOString();
        if (!this.metadata.created) {
            this.metadata.created = this.metadata.lastModified;
        }

        const data = {
            version: '1.0',
            metadata: this.metadata,
            facts: this.facts
        };

        await writeFile(this.memoryPath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    }

    /**
     * Remember a new fact
     * @param {string} fact - The fact to remember
     * @param {string} category - Optional category (context, decision, preference, etc.)
     */
    async remember(fact, category = 'context') {
        const entry = {
            id: Date.now(),
            fact: fact.trim(),
            category,
            timestamp: new Date().toISOString()
        };

        this.facts.push(entry);
        await this.save();
        return entry;
    }

    /**
     * Forget a fact by ID or index
     * @param {number} identifier - Fact ID or index (1-based for user convenience)
     */
    async forget(identifier) {
        // Try by index first (1-based)
        if (identifier > 0 && identifier <= this.facts.length) {
            const removed = this.facts.splice(identifier - 1, 1)[0];
            await this.save();
            return removed;
        }

        // Try by ID
        const index = this.facts.findIndex(f => f.id === identifier);
        if (index !== -1) {
            const removed = this.facts.splice(index, 1)[0];
            await this.save();
            return removed;
        }

        return null;
    }

    /**
     * Clear all memory
     */
    async clear() {
        this.facts = [];
        await this.save();
        return true;
    }

    /**
     * Get all facts as a formatted string for AI context
     */
    getContextString() {
        if (this.facts.length === 0) {
            return '';
        }

        const header = '=== SESSION MEMORY ===\nThe following facts were remembered from previous sessions:\n';
        const factsList = this.facts.map((f, i) =>
            `${i + 1}. [${f.category}] ${f.fact}`
        ).join('\n');

        return header + factsList + '\n=== END MEMORY ===\n\n';
    }

    /**
     * Get facts formatted for display in UI
     */
    getDisplayList() {
        return this.facts.map((f, i) => ({
            index: i + 1,
            ...f,
            displayDate: new Date(f.timestamp).toLocaleDateString()
        }));
    }

    /**
     * Get memory summary for welcome screen
     */
    getSummary() {
        const count = this.facts.length;
        if (count === 0) {
            return 'No session memory stored';
        }

        const categories = {};
        this.facts.forEach(f => {
            categories[f.category] = (categories[f.category] || 0) + 1;
        });

        const breakdown = Object.entries(categories)
            .map(([cat, num]) => `${num} ${cat}`)
            .join(', ');

        return `${count} facts remembered (${breakdown})`;
    }
}

// Singleton instance for easy import
let _memoryInstance = null;

export function getSessionMemory(projectPath = null) {
    if (!_memoryInstance) {
        _memoryInstance = new SessionMemory(projectPath);
    }
    return _memoryInstance;
}

export default SessionMemory;
