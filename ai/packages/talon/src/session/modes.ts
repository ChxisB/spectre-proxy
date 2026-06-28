/**
 * Mode state management for Talon execution modes.
 *
 * Tracks per-session mode state for features like Ultrawork, Team Mode, etc.
 * This is in-memory state only (not persisted) and follows the same pattern
 * as plan mode tracking in reminders.ts.
 */

// ── Types ────────────────────────────────────────────────────────────────

export type UltraworkVariant = "default" | "gpt" | "gemini" | "planner"

export type ModeState = {
  /** Whether ultrawork mode is active for the current session */
  ultrawork: boolean
  /** Which ultrawork prompt variant to use (based on model) */
  ultraworkVariant: UltraworkVariant
  /** The session ID this state applies to */
  sessionID: string | null
}

// ── Defaults ─────────────────────────────────────────────────────────────

const defaultState: ModeState = {
  ultrawork: false,
  ultraworkVariant: "default",
  sessionID: null,
}

// ── In-memory state store ────────────────────────────────────────────────

let currentState: ModeState = { ...defaultState }

// ── Public API ───────────────────────────────────────────────────────────

export function isUltraworkMode(): boolean {
  return currentState.ultrawork
}

export function getUltraworkVariant(): UltraworkVariant {
  return currentState.ultraworkVariant
}

export function getModeState(): Readonly<ModeState> {
  return { ...currentState }
}

export function enableUltraworkMode(
  variant: UltraworkVariant = "default",
  sessionID?: string,
): void {
  currentState.ultrawork = true
  currentState.ultraworkVariant = variant
  if (sessionID) currentState.sessionID = sessionID
}

export function disableUltraworkMode(): void {
  currentState = { ...defaultState }
}

export function resetModeState(): void {
  currentState = { ...defaultState }
}

/**
 * Resolve the ultrawork prompt variant based on the model provider.
 */
export function resolveUltraworkVariant(modelID?: string): UltraworkVariant {
  if (!modelID) return "default"

  const id = modelID.toLowerCase()

  if (id.startsWith("gpt") || id.startsWith("o1") || id.startsWith("o3")) {
    return "gpt"
  }

  if (id.startsWith("gemini")) {
    return "gemini"
  }

  // Planner-like agents
  if (id.includes("planner") || id.includes("prometheus")) {
    return "planner"
  }

  return "default"
}


