/**
 * Context system — loads project-specific patterns, standards, and workflows
 * from `.talon/context/*.md` files and injects them into the system prompt.
 *
 * Inspired by TalonAgentsControl's context system (`.talon/context/`).
 * Context files are markdown with optional YAML frontmatter for metadata:
 *
 * ```yaml
 * ---
 * title: API Patterns
 * priority: high
 * tags: [api, backend, patterns]
 * ---
 * ## API Design Patterns
 * This project uses the following API patterns...
 * ```
 *
 * Context files with `priority: high` are always loaded.
 * Others are loaded on-demand based on relevance to the current task.
 */

export interface ContextFile {
  /** File path */
  path: string
  /** Display title (from frontmatter or filename) */
  title: string
  /** Priority: high always loads, medium/normal loads on relevance */
  priority: "high" | "medium" | "normal"
  /** Tags for relevance matching */
  tags: string[]
  /** Content body (markdown) */
  content: string
  /** Category derived from directory structure */
  category: string
}

/**
 * Load and parse context files from a directory.
 * Scans for `*.md` files recursively, parses frontmatter.
 */
export function loadContextFiles(directory: string, fs: { readdirSync: (dir: string) => string[]; readFileSync: (path: string, enc: string) => string;     statSync: (path: string) => { isDirectory(): boolean } }): ContextFile[] {
  const results: ContextFile[] = []

  function scanDir(dir: string, category: string) {
    try {
      const entries = fs.readdirSync(dir)
      for (const entry of entries) {
        const fullPath = `${dir}/${entry}`
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          scanDir(fullPath, entry)
        } else if (entry.endsWith(".md") && entry !== "navigation.md" && entry !== "index.md") {
          try {
            const content = fs.readFileSync(fullPath, "utf-8")
            const parsed = parseContextFile(fullPath, content, category)
            if (parsed) results.push(parsed)
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  scanDir(directory, "core")
  return results
}

/**
 * Build a formatted context block for system prompt injection.
 */
export function formatContextBlock(contexts: ContextFile[]): string {
  if (contexts.length === 0) return ""

  const high = contexts.filter((c) => c.priority === "high")
  const normal = contexts.filter((c) => c.priority !== "high")

  const lines: string[] = ["<project-context>"]

  if (high.length > 0) {
    lines.push("")
    lines.push("## Active Project Patterns")
    for (const ctx of high) {
      lines.push("")
      lines.push(`### ${ctx.title}`)
      lines.push(ctx.content.trim())
    }
  }

  if (normal.length > 0) {
    lines.push("")
    lines.push("## Available Context")
    lines.push("The following context categories are available on request:")
    for (const ctx of normal) {
      const tags = ctx.tags.length > 0 ? ` [${ctx.tags.join(", ")}]` : ""
      lines.push(`- **${ctx.title}**${tags} — ${ctx.content.split("\n")[0]?.slice(0, 80) || ""}`)
    }
  }

  lines.push("", "</project-context>")
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function parseContextFile(filePath: string, raw: string, category: string): ContextFile | null {
  let title: string = filePath.split("/").pop()?.replace(/\.md$/, "")?.replace(/-/g, " ") || "Untitled"
  let priority: "high" | "medium" | "normal" = "normal"
  let tags: string[] = []
  let content = raw

  const fmMatch = raw.match(FRONTMATTER_RE)
  if (fmMatch) {
    try {
      const fm = parseYaml(fmMatch[1])
      if (fm.title) title = String(fm.title)
      if (fm.priority === "high") priority = "high"
      else if (fm.priority === "medium") priority = "medium"
      if (Array.isArray(fm.tags)) tags = fm.tags.map(String)
      content = raw.slice(fmMatch[0].length).trim()
    } catch {
      // Invalid frontmatter — proceed with defaults
    }
  }

  if (!content) return null

  return { path: filePath, title, priority, tags, content, category }
}

function parseYaml(text: string): Record<string, unknown> {
  // Simple YAML parser for frontmatter (avoids heavy dependency)
  const result: Record<string, unknown> = {}
  for (const line of text.split("\n")) {
    const match = line.match(/^(\w[\w_-]*)\s*:\s*(.+)$/)
    if (match) {
      const key = match[1]
      const raw: string = match[2].trim()

      // Handle arrays: [item1, item2]
      if (raw.startsWith("[") && raw.endsWith("]")) {
        result[key] = raw.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))
        continue
      }
      // Handle quoted strings
      if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        result[key] = raw.slice(1, -1)
        continue
      }

      result[key] = raw
    }
  }
  return result
}
