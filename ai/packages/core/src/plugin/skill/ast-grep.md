# AST-Grep — Pattern-Aware Code Search & Rewriting

Use ast-grep (`sg`) for structure-aware code search and rewriting across 25+ languages. Unlike grep (text-based) or glob (filename-based), ast-grep understands code syntax and can match patterns at the AST level.

## Available Tools

- `ast_grep_search` — Search for AST patterns and see matching code with context
- `ast_grep_rewrite` — Find-and-replace across AST matches using rewrite templates

## When to Use

**Use ast_grep_search instead of grep when:**
- You need to find patterns that span multiple lines
- You need to match based on code structure, not text
- You need to handle nested/recursive patterns (try-catch, if-else, callbacks)
- Grep regex is too brittle for the pattern you need

**Use ast_grep_rewrite when:**
- You need to rename a function across many files (but grep+edit would miss cases)
- You need to restructure patterns across the codebase
- You need to ensure syntactic correctness of replacements

## Pattern Syntax

### Meta-Variables
| Syntax | Meaning | Example |
|--------|---------|---------|
| `$_` | Single node wildcard | `console.log($_)` matches any single argument |
| `$$$` | Multi-node wildcard | `fn($$$)` matches zero or more arguments |
| `$NAME` | Named capture | `function $NAME()` captures the function name |
| `$NAME:` | Typed capture | `$A:kind:number` matches only number-typed nodes |

### Language Support
ast-grep supports: TypeScript, JavaScript, TSX, JSX, Python, Rust, Go, Java, C, C++, C#, Kotlin, Swift, PHP, Ruby, Scala, Dart, Lua, Elixir, Haskell, OCaml, R, Zig, CSS, HTML, JSON, YAML, Markdown, and more.

### Examples

**TypeScript/JavaScript:**
- `console.log($_)` — all console.log calls
- `try { $$$ } catch ($_) { $$$ }` — all try-catch blocks
- `async function $NAME($$$) { $$$ }` — all async functions
- `import { $$$ } from "$MOD"` — all imports from a specific module
- `$OBJ.$METHOD($$$)` — all method calls on an object

**Python:**
- `def $NAME(self, $$$): $$$` — all instance methods
- `with $EXPR as $VAR: $$$` — all context manager usages
- `try: $$$ except $EXC: $$$` — all try-except blocks

**Rust:**
- `fn $NAME(&self, $$$) -> $TYPE { $$$ }` — all &self methods
- `match $EXPR { $$$ }` — all match expressions

## Rules
- Start with ast_grep_search to verify your pattern before using ast_grep_rewrite
- Always quote patterns that contain shell-special characters
- For very large codebases, narrow the search path to avoid timeouts
- Use the language parameter when auto-detection might be ambiguous
