/**
 * AI Slop Guard — detects and optionally strips AI-generated boilerplate comments
 * that commonly appear in LLM-written code (e.g. "// TODO: implement this" stubs).
 *
 * Inspired by oh-my-openagent's comment-checker-core. Patterns compiled from
 * observed LLM behaviours across aider, cline, and codex outputs.
 */

// ---------------------------------------------------------------------------
// Slop patterns: each is a { match, replace, description } triplet.
// The `match` regex captures the slop; `replace` is the cleaned replacement.
// ---------------------------------------------------------------------------

interface SlopPattern {
  /** Regex that matches the slop comment or code */
  match: RegExp
  /** Replacement string (typically empty string or a placeholder) */
  replace: string
  /** Human-readable label for logging */
  label: string
}

const PATTERNS: SlopPattern[] = [
  // -- Stub implementations --
  { match: /\/\/\s*TODO:\s*Implement\s+(this|the\s+\w+)\s*/gi, replace: "", label: "todo-implement-stub" },
  { match: /\/\/\s*TODO:\s*implement\s+/gi, replace: "// TODO: ", label: "todo-implement" },
  { match: /\/\/\s*FIXME:\s*Implement\s+this\s*/gi, replace: "", label: "fixme-implement-stub" },
  { match: /\/\/\s*(?:Your\s+)?(?:code|implementation|logic)\s+(?:here|goes\s+here)\s*/gi, replace: "", label: "code-here-stub" },
  { match: /\/\/\s*(?:Add|Insert|Put)\s+(?:your\s+)?(?:code|implementation|logic)\s+(?:here|below)\s*/gi, replace: "", label: "add-code-stub" },
  { match: /\/\/\s*(?:Implement|Write)\s+(?:the\s+)?(?:logic|function|method|implementation)\s*$/gim, replace: "", label: "implement-logic-stub" },
  { match: /\/\/\s*(?:TODO|FIXME|HACK|XXX)\s*:\s*$/gim, replace: "", label: "empty-todo" },

  // -- Placeholder return values --
  { match: /return\s+null\s*;?\s*\/\/\s*TODO:\s*implement\s*/gi, replace: "return null; // TODO", label: "null-todo" },
  { match: /return\s+undefined\s*;?\s*\/\/\s*TODO:\s*implement\s*/gi, replace: "return undefined; // TODO", label: "undefined-todo" },
  { match: /throw\s+new\s+Error\s*\(\s*["']Not\s+implemented["']\s*\)\s*;?\s*/gi, replace: "", label: "not-implemented-error" },
  { match: /throw\s+new\s+Error\s*\(\s*["']Method\s+not\s+implemented\.?["']\s*\)\s*;?\s*/gi, replace: "", label: "method-not-implemented" },

  // -- AI-typical boilerplate in Python --
  { match: /#\s*TODO:\s*Implement\s+(this|the\s+\w+)\s*/gi, replace: "", label: "py-todo-implement" },
  { match: /#\s*(?:Add|Insert|Put)\s+(?:your\s+)?(?:code|implementation|logic)\s+(?:here|below)\s*/gi, replace: "", label: "py-add-code-stub" },
  { match: /#\s*(?:Your\s+)?(?:code|implementation|logic)\s+(?:here|goes\s+here)\s*/gi, replace: "", label: "py-code-here-stub" },
  { match: /raise\s+NotImplementedError\s*\(\s*["'](?:Method|Function|Class)\s+not\s+implemented["']\s*\)\s*/gi, replace: "raise NotImplementedError", label: "py-not-implemented" },
  { match: /pass\s*#\s*TODO:\s*implement\s*/gi, replace: "pass  # TODO", label: "py-pass-todo" },

  // -- Catch-block stubs --
  { match: /catch\s*\([^)]*\)\s*\{\s*\/\/\s*(?:TODO|FIXME|HANDLE|LOG)\s*(?:\s*:\s*)?(?:error|exception|this|appropriately)?\s*[^}]*\}/gi, replace: "", label: "catch-stub" },
  { match: /except\s+[^:]*:\s*#\s*(?:TODO|FIXME|HANDLE|LOG)\s*(?:\s*:\s*)?(?:error|exception|this|appropriately)?[^#]*/gi, replace: "", label: "except-stub" },

  // -- Generic leftovers --
  { match: /\/\/\s*\.\.\.\s*(?:rest\s+of\s+)?(?:the\s+)?(?:code|implementation|function|method|logic)\s*/gi, replace: "", label: "rest-of-code" },
  { match: /\/\*\s*\.\.\.\s*(?:rest\s+of\s+)?(?:the\s+)?(?:code|implementation|function|method|logic)\s*\*\//gi, replace: "", label: "rest-of-code-block" },
  { match: /#\s*\.\.\.\s*(?:rest\s+of\s+)?(?:the\s+)?(?:code|implementation|function|method|logic)\s*/gi, replace: "", label: "py-rest-of-code" },
  { match: /\/\/\s*more\s+(?:code|methods|functions|logic)\s+(?:here|goes\s+here|to\s+be\s+added)\s*/gi, replace: "", label: "more-code-here" },
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SlopResult {
  /** The cleaned content (same as input if no slop found) */
  cleaned: string
  /** Number of slop instances found and handled */
  count: number
  /** Labels of matched patterns */
  matches: string[]
}

/**
 * Scan content for AI slop patterns and return a report + cleaned version.
 * Does NOT modify the input.
 */
export function checkForSlop(content: string): SlopResult {
  const matches: string[] = []
  let cleaned = content

  for (const pattern of PATTERNS) {
    // Count occurrences
    const copy = cleaned
    cleaned = cleaned.replace(pattern.match, pattern.replace)
    // If something changed, we had a match
    if (copy !== cleaned) {
      matches.push(pattern.label)
    }
  }

  return {
    cleaned,
    count: matches.length,
    matches,
  }
}

/**
 * Strip slop from content. Returns cleaned content.
 * This is idempotent — calling it multiple times is safe.
 */
export function stripSlop(content: string): string {
  let result = content
  for (const pattern of PATTERNS) {
    result = result.replace(pattern.match, pattern.replace)
  }
  return result
}

/**
 * Deduplicate blank lines left after stripping.
 * Collapses 3+ consecutive blank lines into 2.
 */
export function cleanBlankLines(content: string): string {
  return content.replace(/\n{3,}/g, "\n\n")
}
