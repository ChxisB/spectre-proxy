// Output filter system for shell commands.
// Port of rtk's core filtering strategies — compresses command output to reduce
// token consumption before it reaches the LLM context window.
//
// Filters are applied transparently inside ShellTool.run(). The LLM never needs
// to know filtering happened; it just sees cleaner, shorter output.

// ---------------------------------------------------------------------------
// General-purpose text filters (always applied)
// ---------------------------------------------------------------------------

// Strip ANSI escape codes from text. These are common in terminal output but
// useless to the LLM.
export function stripANSI(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
}

// Collapse 3+ consecutive newlines to 2 (preserves paragraph breaks while
// eliminating wasted blank space).
export function normalizeBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n")
}

// Collapse repeated sequential lines into a single line with a repeat count.
// e.g. 50 consecutive "warning: unused import" lines become
//       "warning: unused import (repeated 50 times)"
export function deduplicateSequential(text: string): string {
  const lines = text.split("\n")
  const out: string[] = []
  let count = 1

  for (let i = 0; i < lines.length; i++) {
    if (i + 1 < lines.length && lines[i] === lines[i + 1]) {
      count++
      continue
    }
    if (count > 3) {
      out.push(`${lines[i]} (repeated ${count} times)`)
    } else {
      for (let j = 0; j < count; j++) {
        out.push(lines[i])
      }
    }
    count = 1
  }

  return out.join("\n")
}

// Strip trailing whitespace from each line.
export function stripTrailingWhitespace(text: string): string {
  return text.replace(/[ \t]+$/gm, "")
}

// ---------------------------------------------------------------------------
// Filter config — matches rtk TOML filter semantics
// ---------------------------------------------------------------------------

export interface FilterConfig {
  /** Human-readable description */
  description: string
  /** Regex matched against the command string */
  matchCommand?: string
  /** Drop lines matching any of these regexes */
  stripLinesMatching?: string[]
  /** Keep only lines matching at least one of these regexes */
  keepLinesMatching?: string[]
  /** Regex substitutions (pattern → replacement) */
  replace?: Array<{ pattern: string; replacement: string }>
  /** Truncate lines longer than N characters */
  truncateLinesAt?: number
  /** Keep only the first N lines */
  maxLines?: number
  /** Keep only the last N lines (applied after other filters) */
  tailLines?: number
  /** Fallback message when filtered output is empty */
  onEmpty?: string
}

// ---------------------------------------------------------------------------
// Built-in filter registry
// ---------------------------------------------------------------------------

// The most common commands that benefit from command-specific filtering.
// Ported from rtk's 63 TOML filters — only the highest-impact ones that
// apply to Talon's typical usage (git, build tools, file listings).

const BUILTIN_FILTERS: Record<string, FilterConfig> = {
  "git-status": {
    description: "Compact git status output — group untracked, modified, staged",
    matchCommand: "^git\\s+status",
    stripLinesMatching: [
      "^$",
      "^\\(use ",
      "^nothing to commit",
      "^no changes added",
      "^Changes not staged for commit",
      "^Changes to be committed",
      "^Untracked files",
      "^Your branch is",
      "^  \\(all conflicts fixed",
    ],
    replace: [
      { pattern: "^\\s{2}", replacement: "" },
      { pattern: "modified:\\s+", replacement: "" },
      { pattern: "new file:\\s+", replacement: "" },
      { pattern: "deleted:\\s+", replacement: "" },
      { pattern: "renamed:\\s+", replacement: "" },
    ],
    onEmpty: "git: working tree clean",
  },

  "git-diff": {
    description: "Condensed git diff — keep hunks, strip noise",
    matchCommand: "^git\\s+diff",
    stripLinesMatching: [
      "^diff --git",
      "^index ",
      "^@@" ,
      "^--- ",
      "^\\+\\+\\+ ",
      "^new file mode",
      "^deleted file mode",
      "^old mode ",
      "^new mode ",
    ],
  },

  "git-log": {
    description: "Compact git log — one line per commit",
    matchCommand: "^git\\s+log",
    stripLinesMatching: [
      "^$",
      "^commit ",
      "^Author:",
      "^Date:",
      "^    $",
    ],
  },

  "git-branch": {
    description: "Compact branch listing",
    matchCommand: "^git\\s+branch",
    stripLinesMatching: [
      "^  ",
    ],
  },

  ls: {
    description: "Compact directory listing — remove total and decoration",
    matchCommand: "^ls\\b",
    stripLinesMatching: [
      "^total \\d+",
    ],
  },

  "npm-install": {
    description: "Condensed npm install — keep added/updated packages, skip audit",
    matchCommand: "^npm\\s+(install|i|ci|add)\\b",
    stripLinesMatching: [
      "^npm (notice|warn|http)",
      "^added \\d+ package",
      "^removed \\d+ package",
      "^changed \\d+ package",
      "^audited \\d+ package",
      "^found \\d+ (vulnerability|severity)",
      "^run `npm audit`",
      "^\\d+ packages are looking",
      "^up to date",
      "^$",
    ],
    onEmpty: "npm: up to date",
  },

  "cargo-build": {
    description: "Condensed cargo build — keep errors and warnings, skip compiling lines",
    matchCommand: "^cargo\\s+(build|check|test)\\b",
    stripLinesMatching: [
      "^\\s*(Compiling|Checking|Finished|Fresh|Downloading|Updating|Removing|Packaging|Fixed)",
      "^\\s*(Documentation|Running|Test)",
      "^\\s*(error\\[E|help: |  |For more)",
    ],
    keepLinesMatching: [
      "^error",
      "^warning",
      "^\\s+\\d+ warnings?",
      "^\\s+\\d+ errors?",
    ],
    onEmpty: "cargo: ok",
  },

  "cargo-test": {
    description: "Condensed cargo test output — keep results, skip progress",
    matchCommand: "^cargo\\s+test\\b",
    stripLinesMatching: [
      "^\\s*(Compiling|Checking|Finished|Downloading)",
      "^\\s+test ",
      "^\\s+",
      "^$",
    ],
    keepLinesMatching: [
      "^test result",
      "^error",
      "^warning",
      "^running \\d+ test",
    ],
    truncateLinesAt: 200,
    onEmpty: "cargo test: ok",
  },

  make: {
    description: "Condensed make output — skip entering/leaving directory",
    matchCommand: "^make\\b",
    stripLinesMatching: [
      "^make\\[\\d+\\]: (Entering|Leaving) directory",
    ],
  },

  docker: {
    description: "Compact docker output — skip progress bars and layer info",
    matchCommand: "^docker\\b",
    stripLinesMatching: [
      "^\\s*#\\d+ ",
      "^\\s*=> ",
      "^\\s*-=> ",
      "^\\s*=>=> ",
    ],
    truncateLinesAt: 300,
  },

  "npx-tsc": {
    description: "Condensed TypeScript compiler output — group by error count",
    matchCommand: "^npx\\s+tsc\\b",
    stripLinesMatching: [
      "^\\s*$",
      " TS\\d+",
      "^\\s+at ",
    ],
    tailLines: 30,
  },

  "npx-eslint": {
    description: "Condensed ESLint output — keep problems, skip progress",
    matchCommand: "^npx\\s+eslint\\b",
    stripLinesMatching: [
      "^\\s*$",
    ],
    truncateLinesAt: 300,
    tailLines: 40,
  },

  jest: {
    description: "Condensed jest output — keep test results, skip file-by-file progress",
    matchCommand: "^(npx\\s+)?jest\\b",
    stripLinesMatching: [
      "^\\s*(PASS|FAIL|Tests:)",
      "^\\s+✓|^\\s+✕|^\\s+×|^\\s+●|^\\s+⎯",
    ],
    keepLinesMatching: [
      "^Tests:",
      "^Test Suites:",
      "^Snapshots:",
      "^Time:",
      "^Ran all test suites",
    ],
    onEmpty: "jest: all tests passed",
  },

  "brew-install": {
    description: "Condensed brew install — skip download/extract progress",
    matchCommand: "^brew\\s+install\\b",
    stripLinesMatching: [
      "^==> Downloading",
      "^==> Installing",
      "^==> Pouring",
      "^==> Summary",
      "^🍺 ",
      "^Already downloaded:",
      "^\\s*$",
    ],
    onEmpty: "brew: installed",
  },

  "go-build": {
    description: "Condensed go build output",
    matchCommand: "^go\\s+(build|test|mod)\\b",
    stripLinesMatching: [
      ": undefined",
    ],
  },

  find: {
    description: "Compact find output — deduplicate common prefixes",
    matchCommand: "^find\\b",
    maxLines: 50,
  },

  tree: {
    description: "Compact tree output — limit depth indicators",
    matchCommand: "^tree\\b",
    stripLinesMatching: [
      "^\\s+$",
    ],
    maxLines: 60,
  },

  ps: {
    description: "Compact process listing",
    matchCommand: "^ps\\b",
    stripLinesMatching: [
      "^  PID",
      "^\\s*$",
    ],
  },

  df: {
    description: "Compact disk free — keep only the header and relevant rows",
    matchCommand: "^df\\b",
    stripLinesMatching: [
      "^Filesystem\\s",
      "^\\s*$",
    ],
    truncateLinesAt: 200,
  },

  env: {
    description: "Filtered env — keep only PATH and TALON-related vars",
    matchCommand: "^env\\b",
    keepLinesMatching: [
      "^PATH=",
      "^TALON_",
      "^HOME=",
      "^USER=",
      "^SHELL=",
      "^PWD=",
      "^NODE_ENV=",
      "^BUN_",
    ],
  },
}

// ---------------------------------------------------------------------------
// Filter application
// ---------------------------------------------------------------------------

function compileRegex(pattern: string): RegExp {
  return new RegExp(pattern)
}

function applyConfig(text: string, config: FilterConfig): string {
  let result = text
  const lines = result.split("\n")

  // Strip lines matching
  let filtered = lines
  if (config.stripLinesMatching?.length) {
    const stripPatterns = config.stripLinesMatching.map(compileRegex)
    filtered = filtered.filter((line) => !stripPatterns.some((re) => re.test(line)))
  }

  // Keep only lines matching (mutually exclusive with strip)
  if (config.keepLinesMatching?.length) {
    const keepPatterns = config.keepLinesMatching.map(compileRegex)
    filtered = filtered.filter((line) => keepPatterns.some((re) => re.test(line)))
  }

  // Replace
  if (config.replace?.length) {
    filtered = filtered.map((line) => {
      let result = line
      for (const { pattern, replacement } of config.replace!) {
        result = result.replace(compileRegex(pattern), replacement)
      }
      return result
    })
  }

  // Truncate long lines
  if (config.truncateLinesAt) {
    filtered = filtered.map((line) => {
      if (line.length > config.truncateLinesAt!) {
        return line.slice(0, config.truncateLinesAt!) + "..."
      }
      return line
    })
  }

  // Max lines (keep first N)
  if (config.maxLines && filtered.length > config.maxLines) {
    filtered = filtered.slice(0, config.maxLines)
  }

  // Tail lines (keep last N)
  if (config.tailLines && filtered.length > config.tailLines) {
    filtered = filtered.slice(filtered.length - config.tailLines)
  }

  result = filtered.join("\n")

  // On empty fallback
  if (!result.trim() && config.onEmpty) {
    return config.onEmpty
  }

  return result
}

// ---------------------------------------------------------------------------
// Command-aware filter dispatch
// ---------------------------------------------------------------------------

// Order matters — more specific patterns should come first
const FILTER_ENTRIES = Object.entries(BUILTIN_FILTERS).sort(
  ([, a], [, b]) => (b.matchCommand?.length ?? 0) - (a.matchCommand?.length ?? 0),
)

function matchCommand(command: string): FilterConfig | null {
  for (const [, config] of FILTER_ENTRIES) {
    if (config.matchCommand) {
      try {
        const re = compileRegex(config.matchCommand)
        if (re.test(command)) return config
      } catch {
        // Bad regex — skip
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Apply output filtering to shell command output.
 *
 * The pipeline is:
 *   1. Strip ANSI codes
 *   2. Command-specific filter (if a config matches)
 *   3. Blank line normalization
 *   4. Sequential deduplication
 *   5. Trailing whitespace removal (only after all other transforms)
 *
 * Returns the filtered text and a flag indicating whether filtering was applied.
 */
export function filterOutput(text: string, command: string): { text: string; filtered: boolean } {
  let result = text
  const original = text

  // Step 1: Always strip ANSI
  result = stripANSI(result)

  // Step 2: Command-specific filter
  const config = matchCommand(command)
  if (config) {
    result = applyConfig(result, config)
  }

  // Step 3: Always normalize blank lines
  result = normalizeBlankLines(result)

  // Step 4: Always deduplicate sequential lines
  result = deduplicateSequential(result)

  // Step 5: Strip trailing whitespace
  result = stripTrailingWhitespace(result)

  const filtered = result !== original || result.length < text.length

  return { text: result, filtered }
}

export * as ShellFilter from "./filter"
