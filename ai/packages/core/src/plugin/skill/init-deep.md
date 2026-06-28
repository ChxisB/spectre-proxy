# init-deep — Hierarchical AGENTS.md Knowledge Base Generator

Generate hierarchical AGENTS.md files throughout the project structure to create a self-documenting codebase that improves both token efficiency and agent performance.

## When to Use

Use this skill when:
- The project lacks AGENTS.md / CLAUDE.md / CONTEXT.md files in key directories
- You need to improve the agent's understanding of the codebase structure
- You want to document module boundaries, patterns, and conventions
- The user explicitly asks for `/init-deep` or "initialize deep knowledge base"

## Process

### 1. Analyze the Project Structure

Explore the codebase to understand:
- Top-level directory structure
- Module boundaries and their responsibilities
- Key files and patterns in each module
- Existing AGENTS.md or documentation files

### 2. Generate Root AGENTS.md

Create a root-level AGENTS.md that covers:
- **Project overview**: What this project does, its tech stack
- **Architecture**: High-level architecture and data flow
- **Conventions**: Coding standards, naming, testing patterns
- **Directory map**: What each top-level directory contains
- **Key decisions**: Architectural decisions and their rationale

### 3. Generate Per-Directory AGENTS.md

For each significant directory (depth 1-2), create AGENTS.md files:
- **Purpose**: What this module/directory does
- **Key files**: Important files and their roles
- **Patterns**: Design patterns used in this module
- **Dependencies**: How this module relates to others
- **Usage**: How to use the module's public API

### 4. Guidelines

- Keep AGENTS.md files concise (50-200 lines each)
- Focus on information that helps an AI agent understand the code
- Include file paths and concrete references
- Document edge cases and non-obvious behavior
- Don't restate what's obvious from the code — add value
- Use markdown formatting with headings, lists, and code blocks

### Output Format

Each AGENTS.md should follow this template:
```markdown
# [Directory/Module Name]

Brief description of this module's purpose.

## Key Files
- `src/main.ts` — Entry point, handles X
- `src/utils.ts` — Utility functions for Y

## Conventions
- [Pattern 1]
- [Pattern 2]

## Dependencies
- Depends on: [module A], [module B]
- Used by: [module C]
```
