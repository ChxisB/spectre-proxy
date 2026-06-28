import * as LSPClient from "./client"

const MAX_PER_FILE = 20

export type SeverityFilter = "error" | "warning" | "information" | "hint" | "all"

const SEVERITY_LEVELS: Record<SeverityFilter, number | undefined> = {
  error: 1,
  warning: 2,
  information: 3,
  hint: 4,
  all: undefined,
}

function severityLabel(severity: number): string {
  switch (severity) {
    case 1: return "ERROR"
    case 2: return "WARN"
    case 3: return "INFO"
    case 4: return "HINT"
    default: return "UNKN"
  }
}

export function pretty(diagnostic: LSPClient.Diagnostic) {
  const severity = severityLabel(diagnostic.severity || 1)
  const line = diagnostic.range.start.line + 1
  const col = diagnostic.range.start.character + 1
  return `${severity} [${line}:${col}] ${diagnostic.message}`
}

export function report(file: string, issues: LSPClient.Diagnostic[]) {
  const errors = issues.filter((item) => item.severity === 1)
  if (errors.length === 0) return ""
  const limited = errors.slice(0, MAX_PER_FILE)
  const more = errors.length - MAX_PER_FILE
  const suffix = more > 0 ? `\n... and ${more} more` : ""
  return `<diagnostics file="${file}">\n${limited.map(pretty).join("\n")}${suffix}\n</diagnostics>`
}

export function filterBySeverity(
  diagnostics: LSPClient.Diagnostic[],
  severity: SeverityFilter,
): LSPClient.Diagnostic[] {
  const level = SEVERITY_LEVELS[severity]
  if (level === undefined) return diagnostics
  return diagnostics.filter((d) => d.severity === level)
}

export function formatAll(
  file: string,
  issues: LSPClient.Diagnostic[],
  severity: SeverityFilter = "all",
  maxItems: number = MAX_PER_FILE,
): string {
  const filtered = filterBySeverity(issues, severity)
  if (filtered.length === 0) return "No diagnostics found."
  const limited = filtered.slice(0, maxItems)
  const more = filtered.length - maxItems
  const suffix = more > 0 ? `\n... and ${more} more` : ""
  return `<diagnostics file="${file}">\n${limited.map(pretty).join("\n")}${suffix}\n</diagnostics>`
}

export * as Diagnostic from "./diagnostic"
