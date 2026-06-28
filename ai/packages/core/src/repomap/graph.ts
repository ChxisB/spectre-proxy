import type { FileSymbols } from "./parser"

// ---------------------------------------------------------------------------
// Simple PageRank-inspired file ranking
// ---------------------------------------------------------------------------

const DAMPING = 0.85
const MAX_ITERATIONS = 20
const CONVERGENCE = 0.001

interface Node {
  /** Absolute path */
  path: string
  /** Outgoing edges (imports to other files in workspace) */
  outgoing: Set<number>
  /** Incoming edges (imported by other files) */
  incoming: Set<number>
  /** PageRank score */
  score: number
  /** Bonus for exported symbols count */
  exportBonus: number
}

/**
 * Build a dependency graph from extracted file symbols and rank files by
 * importance using a simple iterative PageRank-like algorithm.
 *
 * Files with more imports (both incoming and well-connected) score higher.
 * Test files are de-prioritized. Files with more exports get a bonus.
 *
 * Returns file paths sorted by rank (highest first).
 */
export function rankFiles(symbols: FileSymbols[]): { path: string; score: number; exports: number }[] {
  if (symbols.length === 0) return []

  // Build a map of normalized path → index
  const pathToIndex = new Map<string, number>()
  const nodes: Node[] = []

  for (let i = 0; i < symbols.length; i++) {
    const s = symbols[i]
    pathToIndex.set(s.file, i)
    nodes.push({
      path: s.file,
      outgoing: new Set(),
      incoming: new Set(),
      score: 1,
      exportBonus: s.exports.length,
    })
  }

  // Build edges from import statements
  for (let i = 0; i < symbols.length; i++) {
    const s = symbols[i]
    for (const imp of s.imports) {
      // Try to find the imported file in our workspace files
      // This is a heuristic: we match by filename (without extension)
      const importBase = imp.replace(/\\.[^/.]+$/, "").split("/").pop() || ""
      if (!importBase) continue

      // Could also match by relative path, but let's keep it simple
      for (const [path, j] of pathToIndex) {
        if (i === j) continue
        const fileBase = path.replace(/\\.[^/.]+$/, "").split("/").pop() || ""
        if (fileBase === importBase || path.includes(imp)) {
          nodes[i].outgoing.add(j)
          nodes[j].incoming.add(i)
        }
      }
    }
  }

  const n = nodes.length

  // Iterative PageRank
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const newScores = new Array(n).fill(0)

    for (let i = 0; i < n; i++) {
      // Dangling node handling: distribute score evenly
      if (nodes[i].outgoing.size === 0) {
        const contribution = nodes[i].score / n
        for (let j = 0; j < n; j++) {
          newScores[j] += contribution * DAMPING
        }
      } else {
        const contribution = (nodes[i].score * DAMPING) / nodes[i].outgoing.size
        for (const j of nodes[i].outgoing) {
          newScores[j] += contribution
        }
      }
    }

    // Add random jump factor
    const dampingMass = (1 - DAMPING) / n
    for (let i = 0; i < n; i++) {
      newScores[i] += dampingMass
      // Export bonus: files with more exports get a slight boost
      newScores[i] += nodes[i].exportBonus * 0.05 / n
    }

    // Check convergence
    let delta = 0
    for (let i = 0; i < n; i++) {
      delta += Math.abs(newScores[i] - nodes[i].score)
      nodes[i].score = newScores[i]
    }

    if (delta < CONVERGENCE) break
  }

  // Penalize test files
  for (let i = 0; i < n; i++) {
    if (symbols[i]?.isTest) {
      nodes[i].score *= 0.3
    }
  }

  // Sort by score descending
  return nodes
    .sort((a, b) => b.score - a.score)
    .filter((n) => n.score > 0.001) // Filter out noise
    .map((n) => ({
      path: n.path,
      score: Math.round(n.score * 1000) / 1000,
      exports: nodes[pathToIndex.get(n.path)!]?.exportBonus ?? 0,
    }))
}
