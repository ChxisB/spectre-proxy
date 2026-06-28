export * as Loop from "./index"

import { DateTime, Schema } from "effect"
import { DateTimeUtcFromMillis } from "effect/Schema"

// ── Types ──────────────────────────────────────────────────────────────

export const LoopRunId = Schema.String.pipe(Schema.brand("LoopRunId"))
export type LoopRunId = Schema.Schema.Type<typeof LoopRunId>

export const LoopTaskStatus = Schema.Literals(["pending", "in_progress", "completed", "cancelled"])
export type LoopTaskStatus = Schema.Schema.Type<typeof LoopTaskStatus>

export const LoopRunStatus = Schema.Literals(["active", "completed", "cancelled"])
export type LoopRunStatus = Schema.Schema.Type<typeof LoopRunStatus>

/** A single task within a loop run */
export const LoopTask = Schema.Struct({
  subject: Schema.String,
  status: LoopTaskStatus,
  updatedAt: DateTimeUtcFromMillis,
})
export type LoopTask = Schema.Schema.Type<typeof LoopTask>

/** An evidence artifact captured during a loop run */
export const LoopEvidence = Schema.Struct({
  what: Schema.String,
  artifact: Schema.String,
  timestamp: DateTimeUtcFromMillis,
})
export type LoopEvidence = Schema.Schema.Type<typeof LoopEvidence>

/** A single loop run */
export const LoopRun = Schema.Struct({
  id: LoopRunId,
  goal: Schema.String,
  status: LoopRunStatus,
  /** Session IDs associated with this run */
  sessionIds: Schema.Array(Schema.String),
  /** How many times the loop has continued */
  continuationCount: Schema.Int,
  /** Tasks tracked within this run */
  tasks: Schema.Array(LoopTask),
  /** Evidence artifacts captured */
  evidence: Schema.Array(LoopEvidence),
  createdAt: DateTimeUtcFromMillis,
  updatedAt: DateTimeUtcFromMillis,
})
export type LoopRun = Schema.Schema.Type<typeof LoopRun>

/** The full loop state file */
export const LoopState = Schema.Struct({
  version: Schema.Literal(1),
  /** The currently active run ID (if any) */
  activeRunId: Schema.optional(LoopRunId),
  /** All loop runs, keyed by ID */
  runs: Schema.Record(Schema.String, LoopRun),
})
export type LoopState = Schema.Schema.Type<typeof LoopState>

// ── Generator ──────────────────────────────────────────────────────────

let counter = 0

/**
 * Generate a unique loop run ID.
 * Format: ulw_YYYYMMDD_NNN
 */
export function generateLoopRunId(): LoopRunId {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, "")
  counter++
  return `ulw_${date}_${String(counter).padStart(3, "0")}` as LoopRunId
}

// ── State Machine ──────────────────────────────────────────────────────

/**
 * Create a new loop run.
 */
export function nowUtc(): DateTime.Utc {
  return DateTime.makeUnsafe(Date.now())
}

export function createLoopRun(goal: string): LoopRun {
  const now = nowUtc()
  return {
    id: generateLoopRunId(),
    goal,
    status: "active",
    sessionIds: [],
    continuationCount: 0,
    tasks: [],
    evidence: [],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Add a session ID to a loop run.
 */
export function addSessionIdToRun(run: LoopRun, sessionId: string): LoopRun {
  if (run.sessionIds.includes(sessionId)) return run
  return {
    ...run,
    sessionIds: [...run.sessionIds, sessionId],
    updatedAt: nowUtc(),
  }
}

/**
 * Add a task to a loop run.
 */
export function addTaskToRun(run: LoopRun, subject: string): LoopRun {
  const now = nowUtc()
  return {
    ...run,
    tasks: [
      ...run.tasks,
      { subject, status: "pending" as const, updatedAt: now },
    ],
    updatedAt: now,
  }
}

/**
 * Update a task's status in a loop run.
 */
export function updateTaskStatus(
  run: LoopRun,
  subject: string,
  status: LoopTaskStatus,
): LoopRun {
  const now = nowUtc()
  const tasks = run.tasks.map((t) =>
    t.subject === subject
      ? { ...t, status, updatedAt: now }
      : t,
  )
  // If task doesn't exist yet, add it
  const exists = tasks.some((t) => t.subject === subject)
  const updated = exists
    ? tasks
    : [...tasks, { subject, status, updatedAt: now }]
  return { ...run, tasks: updated, updatedAt: now }
}

/**
 * Add evidence to a loop run.
 */
export function addEvidence(
  run: LoopRun,
  what: string,
  artifact: string,
): LoopRun {
  const now = nowUtc()
  return {
    ...run,
    evidence: [...run.evidence, { what, artifact, timestamp: now }],
    updatedAt: now,
  }
}

/**
 * Increment the continuation count for a loop run.
 */
export function incrementContinuation(run: LoopRun): LoopRun {
  return {
    ...run,
    continuationCount: run.continuationCount + 1,
    updatedAt: nowUtc(),
  }
}

/**
 * Complete a loop run.
 */
export function completeLoopRun(run: LoopRun): LoopRun {
  return {
    ...run,
    status: "completed" as const,
    updatedAt: nowUtc(),
  }
}

/**
 * Cancel a loop run.
 */
export function cancelLoopRun(run: LoopRun): LoopRun {
  return {
    ...run,
    status: "cancelled" as const,
    updatedAt: nowUtc(),
  }
}

/**
 * Check if a loop run has any incomplete tasks.
 */
export function hasIncompleteTasks(run: LoopRun): boolean {
  return run.tasks.some(
    (t) => t.status === "pending" || t.status === "in_progress",
  )
}

/**
 * Get a summary of incomplete tasks.
 */
export function getIncompleteTasks(run: LoopRun): LoopTask[] {
  return run.tasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  )
}

/**
 * Create an initial empty loop state.
 */
export function createEmptyLoopState(): LoopState {
  return {
    version: 1,
    runs: {},
  }
}

/**
 * Set the active run in the loop state.
 */
export function setActiveRun(
  state: LoopState,
  run: LoopRun,
): LoopState {
  return {
    ...state,
    activeRunId: run.id,
    runs: { ...state.runs, [run.id]: run },
  }
}

/**
 * Update a run in the loop state and optionally set it as active.
 */
export function upsertRun(
  state: LoopState,
  run: LoopRun,
  setActive?: boolean,
): LoopState {
  return {
    ...state,
    ...(setActive ? { activeRunId: run.id } : {}),
    runs: { ...state.runs, [run.id]: run },
  }
}
