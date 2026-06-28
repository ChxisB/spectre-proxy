import { Glob } from "@talon-ai/core/util/glob"

// ---------------------------------------------------------------------------
// Source file extensions to scan — ordered by priority (most common first)
// ---------------------------------------------------------------------------

const SOURCE_PATTERNS = [
  "**/*.ts",
  "**/*.tsx",
  "**/*.js",
  "**/*.jsx",
  "**/*.mjs",
  "**/*.cjs",
  "**/*.py",
  "**/*.rs",
  "**/*.go",
  "**/*.rb",
  "**/*.java",
  "**/*.kt",
  "**/*.swift",
  "**/*.c",
  "**/*.h",
  "**/*.cpp",
  "**/*.hpp",
  "**/*.cs",
  "**/*.vue",
  "**/*.svelte",
  "**/*.php",
  "**/*.rs",
  "**/*.zig",
  "**/*.ex",
  "**/*.exs",
]

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/target/**",
  "**/.next/**",
  "**/__pycache__/**",
  "**/.venv/**",
  "**/venv/**",
  "**/vendor/**",
  "**/.talon/**",
  "**/.claude/**",
  "**/*.min.*",
  "**/*.bundle.*",
  "**/*.generated.*",
  "**/*.d.ts",
]

export interface ScannedFile {
  /** Absolute path to the file */
  path: string
  /** File extension (e.g. ".ts", ".py") */
  ext: string
  /** File content (loaded lazily) */
  content: string
}

/**
 * Scan a workspace directory for source files.
 * Returns up to `maxFiles` files (default 200).
 */
export function scanWorkspace(directory: string, maxFiles = 200): ScannedFile[] {
  const files: ScannedFile[] = []

  for (const pattern of SOURCE_PATTERNS) {
    if (files.length >= maxFiles) break

    try {
      const matches = Glob.scanSync(pattern, {
        cwd: directory,
        absolute: true,
        dot: false,
        symlink: false,
      })

      for (const match of matches) {
        if (files.length >= maxFiles) break
        // Filter out ignored patterns
        const relMatch = match.replace(directory, "")
        const ignored = IGNORE_PATTERNS.some((p) => {
          const pattern = p.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
          return new RegExp(`^${pattern}$`).test(relMatch)
        })
        if (ignored) continue

        try {
          const content = require("fs").readFileSync(match, "utf-8") as string
          // Skip empty files and files without meaningful content
          if (content.trim().length === 0) continue
          files.push({
            path: match,
            ext: match.substring(match.lastIndexOf(".")),
            content,
          })
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Skip pattern-based errors
    }
  }

  return files
}
