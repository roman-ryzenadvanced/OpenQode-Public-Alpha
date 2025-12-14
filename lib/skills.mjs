/**
 * Skills Library - Pre-built AI prompts for common tasks
 * Provides /skills and /skill <name> commands
 * 
 * Original implementation for OpenQode TUI
 */

/**
 * Skill definition structure
 */
const SKILLS = {
    // Development Skills
    test: {
        name: 'Unit Tests',
        description: 'Generate comprehensive unit tests for code',
        category: 'development',
        prompt: `Generate comprehensive unit tests for the provided code.
Include:
- Edge cases and boundary conditions
- Error handling scenarios
- Mock dependencies where appropriate
- Clear test descriptions
- Setup and teardown if needed

Format: Use the appropriate testing framework for the language (Jest, pytest, etc.)`
    },

    refactor: {
        name: 'Refactor Code',
        description: 'Suggest refactoring improvements',
        category: 'development',
        prompt: `Analyze the provided code and suggest refactoring improvements.
Focus on:
- Code clarity and readability
- DRY principle violations
- Performance optimizations
- Design pattern opportunities
- Type safety improvements

Provide before/after examples for each suggestion.`
    },

    review: {
        name: 'Code Review',
        description: 'Perform a thorough code review',
        category: 'development',
        prompt: `Perform a thorough code review of the provided code.
Check for:
- Bugs and logic errors
- Security vulnerabilities
- Performance issues
- Code style and consistency
- Documentation gaps
- Error handling

Rate severity: 🔴 Critical | 🟡 Warning | 🟢 Suggestion`
    },

    debug: {
        name: 'Debug Helper',
        description: 'Help diagnose and fix bugs',
        category: 'development',
        prompt: `Help debug the provided code/error.
Approach:
1. Identify the root cause
2. Explain why the error occurs
3. Provide the fix with explanation
4. Suggest prevention strategies

Include stack trace analysis if provided.`
    },

    // Documentation Skills
    docs: {
        name: 'Documentation',
        description: 'Generate comprehensive documentation',
        category: 'documentation',
        prompt: `Generate comprehensive documentation for the provided code.
Include:
- Overview/purpose
- Installation/setup (if applicable)
- API reference with parameters and return values
- Usage examples
- Configuration options
- Common issues/FAQ

Format: Markdown with proper headings.`
    },

    readme: {
        name: 'README Generator',
        description: 'Create a professional README.md',
        category: 'documentation',
        prompt: `Create a professional README.md for this project.
Include:
- Project title and badges
- Description
- Features list
- Quick start guide
- Installation steps
- Usage examples
- Configuration
- Contributing guidelines
- License

Make it visually appealing with emojis and formatting.`
    },

    // Analysis Skills
    explain: {
        name: 'Code Explainer',
        description: 'Explain code in simple terms',
        category: 'analysis',
        prompt: `Explain the provided code in simple, clear terms.
Structure:
1. High-level purpose (what it does)
2. Step-by-step walkthrough
3. Key concepts used
4. How it fits in larger context

Use analogies where helpful. Suitable for juniors.`
    },

    security: {
        name: 'Security Audit',
        description: 'Check for security vulnerabilities',
        category: 'analysis',
        prompt: `Perform a security audit of the provided code.
Check for:
- Injection vulnerabilities (SQL, XSS, etc.)
- Authentication/authorization issues
- Sensitive data exposure
- Insecure dependencies
- Cryptographic weaknesses
- OWASP Top 10 issues

Severity: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low`
    },

    // Generation Skills
    api: {
        name: 'API Design',
        description: 'Design REST API endpoints',
        category: 'generation',
        prompt: `Design REST API endpoints for the described functionality.
Include:
- Endpoint paths and methods
- Request/response schemas (JSON)
- Status codes
- Authentication requirements
- Rate limiting suggestions
- OpenAPI/Swagger format if helpful`
    },

    schema: {
        name: 'Database Schema',
        description: 'Design database schema',
        category: 'generation',
        prompt: `Design a database schema for the described requirements.
Include:
- Tables and columns with types
- Primary/foreign keys
- Indexes for performance
- Relationships diagram (text-based)
- Migration script if helpful

Consider normalization and query patterns.`
    }
};

/**
 * Get all available skills
 */
export function getAllSkills() {
    return Object.entries(SKILLS).map(([id, skill]) => ({
        id,
        ...skill
    }));
}

/**
 * Get skills grouped by category
 */
export function getSkillsByCategory() {
    const categories = {};

    Object.entries(SKILLS).forEach(([id, skill]) => {
        if (!categories[skill.category]) {
            categories[skill.category] = [];
        }
        categories[skill.category].push({ id, ...skill });
    });

    return categories;
}

/**
 * Get a specific skill by ID
 */
export function getSkill(skillId) {
    return SKILLS[skillId] ? { id: skillId, ...SKILLS[skillId] } : null;
}

/**
 * Execute a skill - returns the prompt to inject
 * @param {string} skillId - Skill ID
 * @param {string} userInput - User's additional input/code
 */
export function executeSkill(skillId, userInput = '') {
    const skill = getSkill(skillId);
    if (!skill) return null;

    const fullPrompt = `[SKILL: ${skill.name}]

${skill.prompt}

USER INPUT/CODE:
${userInput}

Please proceed with the ${skill.name.toLowerCase()} task.`;

    return {
        skill,
        prompt: fullPrompt
    };
}

/**
 * Get formatted skill list for display
 */
export function getSkillListDisplay() {
    const categories = getSkillsByCategory();
    let output = '';

    for (const [category, skills] of Object.entries(categories)) {
        output += `\n📁 ${category.toUpperCase()}\n`;
        skills.forEach(skill => {
            output += `   /skill ${skill.id.padEnd(10)} - ${skill.description}\n`;
        });
    }

    return output;
}

export default {
    getAllSkills,
    getSkillsByCategory,
    getSkill,
    executeSkill,
    getSkillListDisplay
};
