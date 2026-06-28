/**
 * Ralph Loop — Self-referential dev loop for Ultrawork mode.
 *
 * Tracks session-level loop state and provides continuation prompts
 * when there are incomplete tasks. Integrates with the session idle
 * lifecycle to yank the agent back until all work is done.
 *
 * State is in-memory for now (per-session). Future: persist to disk
 * for durability across restarts.
 */

import { Effect, Schema } from "effect"
import { Loop } from "@talon-ai/core/loop"
import { WisdomExtractor } from "@talon-ai/core/wisdom/extractor"
import type { WisdomSchema } from "@talon-ai/core/wisdom/schema"
import type { SessionV1 } from "@talon-ai/core/v1/session"
import ULLOOP_PROMPT from "./prompt/ulw-loop.txt"
import { PartID } from "./schema"
import { ensureEvidenceDir, generateEvidenceDirName, writeEvidenceFile } from "@talon-ai/core/evidence/manager"

// ── Types ──────────────────────────────────────────────────────────────

export type LoopState = {
  /** The active loop run, if any */
  run: Loop.LoopRun | null
  /** The session ID this loop is attached to */
  sessionID: string | null
  /** Whether the loop is active */
  active: boolean
}

// ── Default State ──────────────────────────────────────────────────────

const defaultState: LoopState = {
  run: null,
  sessionID: null,
  active: false,
}

// ── In-Memory State ────────────────────────────────────────────────────

let currentState: LoopState = { ...defaultState }

// Pending wisdom entries extracted from completed loop runs,
// drained by the session lifecycle for Effect-based persistence.
let pendingWisdom: Array<typeof WisdomSchema.WisdomEntryInput.Type> = []

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Start a new loop run with a given goal.
 */
export function startLoop(goal: string, sessionID?: string): Loop.LoopRun {
  const run = Loop.createLoopRun(goal)
  currentState = {
    run,
    sessionID: sessionID ?? null,
    active: true,
  }
  return run
}

/**
 * Get the current loop state.
 */
export function getLoopState(): Readonly<LoopState> {
  return { ...currentState }
}

/**
 * Check if the loop is active.
 */
export function isLoopActive(): boolean {
  return currentState.active && currentState.run !== null
}

/**
 * Get the active run.
 */
export function getActiveRun(): Loop.LoopRun | null {
  return currentState.run
}

/**
 * Add a task to the current loop run.
 */
export function addTask(subject: string): void {
  if (!currentState.run) return
  currentState.run = Loop.addTaskToRun(currentState.run, subject)
}

/**
 * Update a task's status.
 */
export function updateTask(subject: string, status: Loop.LoopTaskStatus): void {
  if (!currentState.run) return
  currentState.run = Loop.updateTaskStatus(currentState.run, subject, status)
}

/**
 * Add evidence to the current loop run.
 */
export function addEvidence(what: string, artifact: string): void {
  if (!currentState.run) return
  currentState.run = Loop.addEvidence(currentState.run, what, artifact)
}

/**
 * Increment the continuation counter.
 */
export function incrementContinuation(): void {
  if (!currentState.run) return
  currentState.run = Loop.incrementContinuation(currentState.run)
}

/**
 * Complete the current loop run.
 */
export function completeLoop(): void {
  if (!currentState.run) return
  currentState.run = Loop.completeLoopRun(currentState.run)
  currentState.active = false

  const evidence = currentState.run.evidence.map((e) => ({
    what: e.what,
    artifact: e.artifact,
    timestamp: Date.now(),
  }))
  pendingWisdom.push(...WisdomExtractor.extractFromLoopEvidence(evidence))
}

  export function drainPendingWisdom(): Array<typeof WisdomSchema.WisdomEntryInput.Type> {
    const items = [...pendingWisdom]
    pendingWisdom = []
    return items
  }

  /**
   * Auto-save evidence to disk when a loop run completes.
   * Only saves if there is at least 1 evidence item and a goal.
   */
  export async function autoSaveEvidence(): Promise<string | undefined> {
    if (!currentState.run || currentState.run.evidence.length === 0 || !currentState.run.goal) return

    const evidenceItems = currentState.run.evidence
    const goal = currentState.run.goal
    const dirName = generateEvidenceDirName(goal)

    const ts = Date.now()
    const scenarios = evidenceItems.map((e, i) => ({
      name: `evidence-${i + 1}`,
      category: "happy" as const,
      passCondition: e.what,
      status: "pass" as const,
      assertionMessage: e.artifact,
      capturedAt: ts,
    }))

    const totalScenarios = scenarios.length
    const passedScenarios = scenarios.filter((s) => s.status === "pass").length

    const entry = {
      id: dirName,
      sessionID: currentState.sessionID ?? "",
      title: goal,
      goal,
      scenarios,
      totalScenarios,
      passedScenarios,
      failedScenarios: 0,
      createdAt: ts,
      completedAt: ts,
    }

    const projectRoot = process.cwd()
    await ensureEvidenceDir(projectRoot)
    return await writeEvidenceFile(projectRoot, dirName, entry as any)
  }

/**
 * Cancel the current loop run.
 */
export function cancelLoop(): void {
  if (!currentState.run) return
  currentState.run = Loop.cancelLoopRun(currentState.run)
  currentState.active = false
}

/**
 * Check if there are incomplete tasks.
 */
export function hasIncompleteTasks(): boolean {
  return currentState.run ? Loop.hasIncompleteTasks(currentState.run) : false
}

/**
 * Get a summary of incomplete tasks for the continuation prompt.
 */
export function getIncompleteTaskSummary(): string {
  if (!currentState.run) return ""
  const tasks = Loop.getIncompleteTasks(currentState.run)
  if (tasks.length === 0) return "No incomplete tasks."
  return tasks.map((t) => `- ${t.subject}`).join("\n")
}

/**
 * Generate the continuation prompt for the user message.
 */
export function buildContinuationPrompt(): string | null {
  if (!currentState.run) return null
  const incompleteTasks = Loop.getIncompleteTasks(currentState.run)
  if (incompleteTasks.length === 0) return null

  const goal = currentState.run.goal
  const continuationCount = currentState.run.continuationCount
  const taskList = incompleteTasks.map((t) => `- ${t.subject}`).join("\n")
  const evidenceLog =
    currentState.run.evidence.length > 0
      ? `Evidence captured so far:\n${currentState.run.evidence.map((e) => `- ${e.what}: ${e.artifact}`).join("\n")}`
      : "No evidence captured yet."

  return ULLOOP_PROMPT.replace("${incompleteTasks}", taskList)
    .replace("${goal}", goal)
    .replace("${continuationCount}", String(continuationCount))
    .replace("${evidenceLog}", evidenceLog)
}

/**
 * Inject the continuation prompt into a user message's parts.
 */
export function injectContinuationPrompt(
  parts: Array<{ id: string; messageID: string; sessionID: string; type: string; text?: string; synthetic?: boolean }>,
): void {
  const prompt = buildContinuationPrompt()
  if (!prompt) return

  // Find the last user message part
  const lastTextPart = [...parts].reverse().find((p) => p.type === "text")
  if (!lastTextPart) return

  // Increment continuation counter
  incrementContinuation()

  // Append the continuation prompt to the last user text
  lastTextPart.text = `${lastTextPart.text ?? ""}\n\n${prompt}`
}

/**
 * Reset the loop state entirely.
 */
export function resetLoop(): void {
  currentState = { ...defaultState }
}

export * as SessionLoop from "./loop"
