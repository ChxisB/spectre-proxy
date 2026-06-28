export * as WisdomExtractor from "./extractor"

import type { WisdomEntryInput } from "./schema"

export function parseCompactionSummaryText(text: string): {
  goal?: string
  keyDecisions?: string
  criticalContext?: string
  nextSteps?: string
} {
  const sections: Record<string, string> = {}
  const lines = text.split("\n")
  let currentSection: string | undefined

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/)
    if (headerMatch) {
      currentSection = headerMatch[1].trim()
      sections[currentSection] = ""
      continue
    }
    if (currentSection) {
      sections[currentSection] = (sections[currentSection] ?? "") + line + "\n"
    }
  }

  return {
    goal: sections["Goal"]?.trim(),
    keyDecisions: sections["Key Decisions"]?.trim(),
    criticalContext: sections["Critical Context"]?.trim(),
    nextSteps: sections["Next Steps"]?.trim(),
  }
}

export function extractFromCompactionSummary(summary: {
  keyDecisions?: string
  criticalContext?: string
  nextSteps?: string
  goal?: string
}): WisdomEntryInput[] {
  const entries: WisdomEntryInput[] = []

  if (summary.goal && summary.goal !== "(none)" && summary.goal !== "- (none)") {
    entries.push({
      insight: summary.goal.replace(/^-\s*/, ""),
      source: "compaction",
      tags: generateTags(summary.goal),
      relevance: 0.7,
    })
  }

  if (summary.keyDecisions && summary.keyDecisions !== "(none)" && summary.keyDecisions !== "- (none)") {
    const lines = summary.keyDecisions
      .split("\n")
      .map((l) => l.replace(/^-\s*/, "").trim())
      .filter(Boolean)
    for (const line of lines) {
      entries.push({
        insight: line,
        source: "compaction",
        tags: generateTags(line, ["decision"]),
        relevance: 0.85,
      })
    }
  }

  if (summary.criticalContext && summary.criticalContext !== "(none)" && summary.criticalContext !== "- (none)") {
    const lines = summary.criticalContext
      .split("\n")
      .map((l) => l.replace(/^-\s*/, "").trim())
      .filter(Boolean)
    for (const line of lines) {
      entries.push({
        insight: line,
        source: "compaction",
        tags: generateTags(line, ["context"]),
        relevance: 0.75,
      })
    }
  }

  if (summary.nextSteps && summary.nextSteps !== "(none)" && summary.nextSteps !== "- (none)") {
    const lines = summary.nextSteps
      .split("\n")
      .map((l) => l.replace(/^-\s*/, "").trim())
      .filter(Boolean)
    for (const line of lines) {
      entries.push({
        insight: line,
        source: "compaction",
        tags: generateTags(line, ["next-step"]),
        relevance: 0.6,
      })
    }
  }

  return entries
}

export function extractFromLoopEvidence(evidence: Array<{
  what: string
  artifact: string
  timestamp: number
}>): WisdomEntryInput[] {
  return evidence.map((item) => ({
    insight: `${item.what}: ${item.artifact}`,
    source: "loop",
    tags: generateTags(`${item.what} ${item.artifact}`),
    relevance: 0.5,
  }))
}

const TAG_PATTERNS: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /\b(architect|architecture|design pattern|component|module|system)\b/i, tag: "architecture" },
  { pattern: /\b(bug|fix|error|crash|failure|issue|regression)\b/i, tag: "bug-fix" },
  { pattern: /\b(tool|script|automation|workflow|pipeline)\b/i, tag: "tooling" },
  { pattern: /\b(test|spec|assert|coverage|mock)\b/i, tag: "testing" },
  { pattern: /\b(deploy|release|ci|cd|publish|rollback)\b/i, tag: "deployment" },
  { pattern: /\b(config|configuration|setting|option|flag)\b/i, tag: "configuration" },
  { pattern: /\b(perf|performance|optimize|slow|latency|throughput)\b/i, tag: "performance" },
  { pattern: /\b(security|auth|permission|access|token|credential|password)\b/i, tag: "security" },
  { pattern: /\b(api|endpoint|route|request|response|rest|graphql)\b/i, tag: "api" },
  { pattern: /\b(database|db|query|schema|migration|sql|orm)\b/i, tag: "database" },
  { pattern: /\b(ui|ux|interface|component|render|display|style|css)\b/i, tag: "ui" },
  { pattern: /\b(doc|documentation|readme|comment|changelog)\b/i, tag: "documentation" },
  { pattern: /\b(refactor|cleanup|tech.debt|legacy|migration)\b/i, tag: "refactoring" },
  { pattern: /\b(session|context|conversation|compaction|summary)\b/i, tag: "session" },
  { pattern: /\b(dependency|package|version|upgrade|deprecat)\b/i, tag: "dependencies" },
  { pattern: /\b(decision|choice|rationale|trade.?off|why)\b/i, tag: "decision" },
  { pattern: /\b(context|background|prerequisite|assumption)\b/i, tag: "context" },
]

export function generateTags(insight: string, existingTags?: string[]): string[] {
  const tags = new Set(existingTags ?? [])
  for (const { pattern, tag } of TAG_PATTERNS) {
    if (pattern.test(insight)) {
      tags.add(tag)
    }
  }
  if (tags.size === 0) tags.add("general")
  return Array.from(tags).sort()
}
