import type { WisdomSchema } from "@talon-ai/core/wisdom/schema"

export function injectWisdom(
  wisdom: Array<typeof WisdomSchema.WisdomEntry.Type>,
  project?: string,
): string | undefined {
  const sorted = [...wisdom]
    .sort((a, b) => (b.relevance * b.accessCount) - (a.relevance * a.accessCount))
    .slice(0, 5)

  if (sorted.length === 0) return undefined

  const lines: string[] = []
  lines.push("<accumulated-wisdom>")
  if (project) lines.push(`  <project>${escapeXml(project)}</project>`)
  for (const entry of sorted) {
    const tags = entry.tags.length > 0 ? ` tags="${entry.tags.join(", ")}"` : ""
    lines.push(`  <entry relevance="${entry.relevance.toFixed(2)}" source="${entry.source}"${tags}>`)
    lines.push(`    ${escapeXml(entry.insight)}`)
    lines.push("  </entry>")
  }
  lines.push("</accumulated-wisdom>")

  return lines.join("\n")
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
