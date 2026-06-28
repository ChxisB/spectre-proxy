export * as EvidenceVerifier from "./verifier"

import fs from "fs"
import path from "path"
import type { EvidenceSummary } from "./schema"
import { listEvidence } from "./manager"

export type EvidenceGateResult = {
  passed: boolean
  hasEvidence: boolean
  recentEvidence: EvidenceSummary[]
  failures: string[]
}

export async function verifyEvidenceGate(
  projectRoot: string,
  config: { mode: "warn" | "block" },
): Promise<EvidenceGateResult> {
  const failures: string[] = []
  const recent = await listEvidence(projectRoot, 10)
  const hasEvidence = recent.length > 0

    if (config.mode === "block") {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
      const recentInWindow = recent.filter((e) => {
        const millis = typeof e.createdAt === "object" && e.createdAt !== null && "millis" in e.createdAt
          ? (e.createdAt as { millis: number }).millis
          : new Date(e.createdAt as any).getTime()
        return millis > oneDayAgo
      })

    if (!hasEvidence) {
      failures.push("No evidence found in .talon/evidence/")
    } else if (recentInWindow.length === 0) {
      failures.push("No evidence found in the last 24 hours")
    }

    if (failures.length > 0) {
      return { passed: false, hasEvidence, recentEvidence: recent, failures }
    }
  }

  return { passed: true, hasEvidence, recentEvidence: recent, failures }
}

export function formatEvidenceStatus(result: EvidenceGateResult): string {
  const lines: string[] = []
  lines.push(`Evidence Gate: ${result.passed ? "✅ PASSED" : "❌ BLOCKED"}`)
  lines.push(`  Mode: ${result.failures.length > 0 ? "block" : "warn"}`)
  lines.push(`  Evidence present: ${result.hasEvidence ? "yes" : "no"}`)

  if (result.recentEvidence.length > 0) {
    lines.push(`  Recent entries: ${result.recentEvidence.length}`)
    for (const entry of result.recentEvidence.slice(0, 5)) {
      const passRate =
        entry.totalScenarios > 0
          ? Math.round((entry.passedScenarios / entry.totalScenarios) * 100)
          : 0
      lines.push(
        `    - ${entry.title} (${entry.passedScenarios}/${entry.totalScenarios} passed, ${passRate}%)`,
      )
    }
  }

  if (result.failures.length > 0) {
    lines.push("  Failures:")
    for (const f of result.failures) {
      lines.push(`    ❌ ${f}`)
    }
  }

  return lines.join("\n")
}
