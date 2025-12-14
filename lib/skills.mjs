/**
 * Skills Library - Anthropic-compatible AI prompts for OpenQode TUI
 * Imported from: https://github.com/anthropics/skills/tree/main/skills
 * Plus original development-focused skills
 * 
 * Original implementation for OpenQode TUI
 */

/**
 * Anthropic Official Skills (16)
 */
const ANTHROPIC_SKILLS = {
    // Design & Creative
    'algorithmic-art': {
        name: 'Algorithmic Art',
        description: 'Create generative and algorithmic art pieces',
        category: 'design',
        prompt: `You are an expert in algorithmic and generative art.
Help the user create beautiful algorithmic art pieces using code.
Focus on:
- Mathematical patterns and fractals
- Procedural generation techniques
- Color theory and palettes
- SVG, Canvas, or Processing-style code
- Creating visually stunning outputs`
    },

    'brand-guidelines': {
        name: 'Brand Guidelines',
        description: 'Create comprehensive brand identity guidelines',
        category: 'design',
        prompt: `You are a brand identity expert.
Create comprehensive brand guidelines including:
- Logo usage rules and variations
- Color palette (primary, secondary, accent)
- Typography hierarchy
- Voice and tone guidelines
- Do's and don'ts
- Application examples`
    },

    'canvas-design': {
        name: 'Canvas Design',
        description: 'Design interactive canvas-based graphics',
        category: 'design',
        prompt: `You are an expert in HTML Canvas graphics.
Create interactive canvas-based designs including:
- Animations and transitions
- User interaction handling
- Particle systems
- Drawing and painting tools
- Game graphics
- Data visualizations`
    },

    'theme-factory': {
        name: 'Theme Factory',
        description: 'Create custom themes for applications',
        category: 'design',
        prompt: `You are a theming expert.
Create comprehensive themes including:
- Color schemes (light/dark modes)
- CSS variables and tokens
- Component styling
- Consistent spacing and typography
- Accessibility considerations
- Theme switching logic`
    },

    'frontend-design': {
        name: 'Frontend Design',
        description: 'Design beautiful frontend interfaces',
        category: 'design',
        prompt: `You are a frontend design expert.
Create stunning, modern UI designs with:
- Responsive layouts
- Modern CSS techniques (Grid, Flexbox)
- Micro-interactions and animations
- Accessibility best practices
- Performance optimization
- Cross-browser compatibility`
    },

    // Document Generation
    'pdf': {
        name: 'PDF Generator',
        description: 'Generate professional PDF documents',
        category: 'documents',
        prompt: `You are a PDF generation expert.
Create professional PDF documents with:
- Proper structure and formatting
- Headers, footers, page numbers
- Tables and figures
- Code for generating PDFs (jsPDF, pdfkit, etc.)
- Print-ready layouts
- Accessibility features`
    },

    'docx': {
        name: 'Word Document',
        description: 'Generate Microsoft Word documents',
        category: 'documents',
        prompt: `You are a document generation expert.
Create professional Word documents with:
- Proper heading hierarchy
- Styled paragraphs and lists
- Tables and images
- Headers and footers
- Code for generating DOCX (docx npm package)
- Template-based generation`
    },

    'pptx': {
        name: 'PowerPoint Slides',
        description: 'Generate presentation slides',
        category: 'documents',
        prompt: `You are a presentation expert.
Create compelling PowerPoint presentations with:
- Clear slide structure
- Visual hierarchy
- Charts and diagrams
- Speaker notes
- Code for generating PPTX (pptxgenjs)
- Consistent branding`
    },

    'xlsx': {
        name: 'Excel Spreadsheet',
        description: 'Generate Excel spreadsheets with data',
        category: 'documents',
        prompt: `You are a spreadsheet expert.
Create professional Excel spreadsheets with:
- Formatted tables and cells
- Formulas and calculations
- Charts and visualizations
- Multiple worksheets
- Code for generating XLSX (exceljs, xlsx)
- Data validation`
    },

    // Communication
    'doc-coauthoring': {
        name: 'Document Co-Author',
        description: 'Collaborate on document writing',
        category: 'writing',
        prompt: `You are a collaborative writing expert.
Help co-author documents with:
- Maintaining consistent voice and style
- Seamless section integration
- Constructive editing suggestions
- Version tracking awareness
- Clear handoff points
- Coherent narrative flow`
    },

    'internal-comms': {
        name: 'Internal Communications',
        description: 'Write internal company communications',
        category: 'writing',
        prompt: `You are an internal communications expert.
Create effective internal communications:
- Company announcements
- Team updates
- Policy communications
- Change management messages
- Appropriate tone for audience
- Clear calls to action`
    },

    'slack-gif-creator': {
        name: 'Slack GIF Creator',
        description: 'Create custom GIFs for Slack',
        category: 'creative',
        prompt: `You are a GIF creation expert.
Create engaging animated GIFs for Slack:
- Reaction GIFs
- Celebration animations
- Custom team expressions
- Appropriate file sizes
- Loop optimization
- Accessibility considerations`
    },

    // Development
    'mcp-builder': {
        name: 'MCP Builder',
        description: 'Build Model Context Protocol servers',
        category: 'development',
        prompt: `You are an MCP (Model Context Protocol) expert.
Build MCP servers and tools with:
- Proper protocol implementation
- Tool definitions
- Resource handling
- Error handling
- TypeScript/JavaScript implementation
- Integration with Claude/AI assistants`
    },

    'web-artifacts-builder': {
        name: 'Web Artifacts Builder',
        description: 'Create interactive web artifacts',
        category: 'development',
        prompt: `You are a web artifacts expert.
Create self-contained, interactive web artifacts:
- Single HTML file with embedded CSS/JS
- Interactive components
- Data visualizations
- Mini applications
- Shareable code snippets
- No external dependencies`
    },

    'webapp-testing': {
        name: 'Web App Testing',
        description: 'Comprehensive web application testing',
        category: 'testing',
        prompt: `You are a web application testing expert.
Create comprehensive test suites including:
- Unit tests (Jest, Vitest)
- Integration tests
- E2E tests (Playwright, Cypress)
- Visual regression tests
- Performance testing
- Accessibility testing
- Coverage reports`
    },

    'skill-creator': {
        name: 'Skill Creator',
        description: 'Create new Claude skills',
        category: 'meta',
        prompt: `You are a skill creation expert.
Help create new Claude/AI skills with:
- Clear skill definition
- Detailed prompts
- Example inputs/outputs
- Edge case handling
- Testing guidelines
- Documentation`
    }
};

/**
 * Development Skills (Original OpenQode)
 */
const DEV_SKILLS = {
    'test': {
        name: 'Unit Tests',
        description: 'Generate comprehensive unit tests',
        category: 'development',
        prompt: `Generate comprehensive unit tests for the provided code.
Include:
- Edge cases and boundary conditions
- Error handling scenarios
- Mock dependencies where appropriate
- Clear test descriptions
- Setup and teardown if needed
Format: Use the appropriate testing framework (Jest, pytest, etc.)`
    },

    'refactor': {
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
Provide before/after examples.`
    },

    'review': {
        name: 'Code Review',
        description: 'Perform thorough code review',
        category: 'development',
        prompt: `Perform a thorough code review.
Check for:
- Bugs and logic errors
- Security vulnerabilities
- Performance issues
- Code style consistency
- Documentation gaps
- Error handling
Rate severity: 🔴 Critical | 🟡 Warning | 🟢 Suggestion`
    },

    'security': {
        name: 'Security Audit',
        description: 'Check for security vulnerabilities',
        category: 'development',
        prompt: `Perform a security audit.
Check for:
- Injection vulnerabilities (SQL, XSS)
- Authentication/authorization issues
- Sensitive data exposure
- Cryptographic weaknesses
- OWASP Top 10 issues
Severity: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low`
    },

    'docs': {
        name: 'Documentation',
        description: 'Generate comprehensive documentation',
        category: 'documentation',
        prompt: `Generate comprehensive documentation.
Include:
- Overview/purpose
- API reference with parameters
- Usage examples
- Configuration options
- Common issues/FAQ
Format: Markdown with proper headings.`
    },

    'explain': {
        name: 'Code Explainer',
        description: 'Explain code in simple terms',
        category: 'development',
        prompt: `Explain the provided code in simple, clear terms.
Structure:
1. High-level purpose
2. Step-by-step walkthrough
3. Key concepts used
4. How it fits in context
Use analogies. Suitable for juniors.`
    },

    'api': {
        name: 'API Design',
        description: 'Design REST API endpoints',
        category: 'development',
        prompt: `Design REST API endpoints.
Include:
- Endpoint paths and methods
- Request/response schemas (JSON)
- Status codes
- Authentication requirements
- Rate limiting suggestions
- OpenAPI/Swagger format`
    },

    'schema': {
        name: 'Database Schema',
        description: 'Design database schema',
        category: 'development',
        prompt: `Design a database schema.
Include:
- Tables and columns with types
- Primary/foreign keys
- Indexes for performance
- Relationships diagram
- Migration script
Consider normalization and queries.`
    }
};

// Merge all skills
const SKILLS = { ...ANTHROPIC_SKILLS, ...DEV_SKILLS };

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
 * Execute a skill
 */
export function executeSkill(skillId, userInput = '') {
    const skill = getSkill(skillId);
    if (!skill) return null;

    return {
        skill,
        prompt: `[SKILL: ${skill.name}]\n\n${skill.prompt}\n\nUSER INPUT:\n${userInput}`
    };
}

/**
 * Get formatted skill list for display
 */
export function getSkillListDisplay() {
    const categories = getSkillsByCategory();
    let output = '';

    const categoryOrder = ['design', 'documents', 'development', 'testing', 'writing', 'creative', 'documentation', 'meta'];

    for (const category of categoryOrder) {
        if (categories[category]) {
            output += `\n📁 ${category.toUpperCase()}\n`;
            categories[category].forEach(skill => {
                output += `   /skill ${skill.id.padEnd(20)} ${skill.description}\n`;
            });
        }
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
