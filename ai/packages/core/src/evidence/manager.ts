export * as EvidenceManager from "./manager"

import fs from "fs"
import path from "path"
import type { EvidenceEntry, EvidenceSummary } from "./schema"

export function generateEvidenceDirName(title: string): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, "")
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  return `${date}-${slug}`
}

export async function ensureEvidenceDir(projectRoot: string): Promise<string> {
  const dir = path.join(projectRoot, ".talon", "evidence")
  await fs.promises.mkdir(dir, { recursive: true })
  return dir
}

export async function writeEvidenceFile(
  projectRoot: string,
  dirName: string,
  entry: EvidenceEntry,
): Promise<string> {
  const dir = path.join(projectRoot, ".talon", "evidence", dirName)
  await fs.promises.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, "evidence.json")
  await fs.promises.writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8")
  return filePath
}

export async function listEvidence(
  projectRoot: string,
  limit?: number,
): Promise<EvidenceSummary[]> {
  const dir = path.join(projectRoot, ".talon", "evidence")
  try {
    await fs.promises.access(dir)
  } catch {
    return []
  }

  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  const dirs = entries.filter((e) => e.isDirectory())

  const results: EvidenceSummary[] = []

  for (const d of dirs) {
    try {
      const filePath = path.join(dir, d.name, "evidence.json")
      const content = await fs.promises.readFile(filePath, "utf-8")
      const parsed = JSON.parse(content)
      results.push({
        id: parsed.id,
        title: parsed.title,
        goal: parsed.goal,
        totalScenarios: parsed.totalScenarios,
        passedScenarios: parsed.passedScenarios,
        failedScenarios: parsed.failedScenarios,
        createdAt: parsed.createdAt,
      })
    } catch {
      // Skip malformed entries
    }
  }

    results.sort((a, b) => {
      const aMillis = typeof a.createdAt === "object" && a.createdAt !== null && "millis" in a.createdAt
        ? (a.createdAt as { millis: number }).millis
        : new Date(a.createdAt as any).getTime()
      const bMillis = typeof b.createdAt === "object" && b.createdAt !== null && "millis" in b.createdAt
        ? (b.createdAt as { millis: number }).millis
        : new Date(b.createdAt as any).getTime()
      return bMillis - aMillis
    })

  return limit ? results.slice(0, limit) : results
}

export async function getEvidence(
  projectRoot: string,
  dirName: string,
): Promise<EvidenceEntry | undefined> {
  const filePath = path.join(projectRoot, ".talon", "evidence", dirName, "evidence.json")
  try {
    await fs.promises.access(filePath)
    const content = await fs.promises.readFile(filePath, "utf-8")
    return JSON.parse(content)
  } catch {
    return undefined
  }
}
