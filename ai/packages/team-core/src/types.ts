import { Schema } from "effect"
import { DateTimeUtcFromMillis } from "effect/Schema"

// ── Enums ──────────────────────────────────────────────────────────────

/** Types of messages that can be sent between team members */
export const MessageKind = Schema.Literals([
  "message",
  "shutdown_request",
  "shutdown_approved",
  "shutdown_rejected",
  "announcement",
])
export type MessageKind = Schema.Schema.Type<typeof MessageKind>

/** How a member is specified in the team spec */
export const MemberKind = Schema.Literals(["category", "subagent_type"])
export type MemberKind = Schema.Schema.Type<typeof MemberKind>

/** Status of a task on the shared tasklist */
export const TaskStatus = Schema.Literals([
  "pending",
  "claimed",
  "in_progress",
  "completed",
  "deleted",
])
export type TaskStatus = Schema.Schema.Type<typeof TaskStatus>

/** Status of a team run */
export const RuntimeStatus = Schema.Literals([
  "creating",
  "active",
  "shutdown_requested",
  "deleting",
  "deleted",
  "failed",
  "orphaned",
])
export type RuntimeStatus = Schema.Schema.Type<typeof RuntimeStatus>

/** Status of a team member within a run */
export const MemberStatus = Schema.Literals([
  "pending",
  "running",
  "idle",
  "errored",
  "completed",
  "shutdown_approved",
])
export type MemberStatus = Schema.Schema.Type<typeof MemberStatus>

/** Member role within the team */
export const MemberRole = Schema.Literals(["leader", "general-purpose"])
export type MemberRole = Schema.Schema.Type<typeof MemberRole>

// ── Branded IDs ────────────────────────────────────────────────────────

export const TeamName = Schema.String.pipe(Schema.brand("TeamName"))
export type TeamName = Schema.Schema.Type<typeof TeamName>

export const TeamRunId = Schema.String.pipe(Schema.brand("TeamRunId"))
export type TeamRunId = Schema.Schema.Type<typeof TeamRunId>

export const MessageId = Schema.String.pipe(Schema.brand("TeamMessageId"))
export type MessageId = Schema.Schema.Type<typeof MessageId>

export const TaskId = Schema.String.pipe(Schema.brand("TeamTaskId"))
export type TaskId = Schema.Schema.Type<typeof TaskId>

// ── Member Schemas ─────────────────────────────────────────────────────

/** Common fields shared by all member kinds */
const MemberCommon = {
  name: Schema.String,
  /** Optional custom working directory */
  cwd: Schema.optional(Schema.String),
  /** Optional git worktree path */
  worktreePath: Schema.optional(Schema.String),
  /** Which message types this member subscribes to */
  subscriptions: Schema.optional(Schema.Array(MessageKind)),
  /** Backend type identifier */
  backendType: Schema.optional(Schema.String),
  /** Display color */
  color: Schema.optional(Schema.String),
  /** Whether this member starts active immediately */
  isActive: Schema.optional(Schema.Boolean),
}

/** A category-based member (routed through sisyphus-junior) */
export const CategoryMember = Schema.Struct({
  ...MemberCommon,
  kind: Schema.Literal("category"),
  category: Schema.String,
  prompt: Schema.String,
})
export type CategoryMember = Schema.Schema.Type<typeof CategoryMember>

/** A direct subagent-type member */
export const SubagentTypeMember = Schema.Struct({
  ...MemberCommon,
  kind: Schema.Literal("subagent_type"),
  subagentType: Schema.String,
  /** Optional prompt overrides */
  prompt: Schema.optional(Schema.String),
})
export type SubagentTypeMember = Schema.Schema.Type<typeof SubagentTypeMember>

/** A team member (discriminated union by kind) */
export const Member = Schema.Union([CategoryMember, SubagentTypeMember])
export type Member = Schema.Schema.Type<typeof Member>

// ── Team Spec ──────────────────────────────────────────────────────────

/** The team specification — defines the team's composition and config */
export const TeamSpec = Schema.Struct({
  /** Schema version (currently 1) */
  version: Schema.Literal(1),
  /** Team name (used for discovery and reference) */
  name: TeamName,
  /** Optional description of the team's purpose */
  description: Schema.optional(Schema.String),
  /** When the spec was created */
  createdAt: Schema.optional(DateTimeUtcFromMillis),
  /** Agent type ID of the team lead (must match a member) */
  leadAgentId: Schema.optional(Schema.String),
  /** Paths the team is allowed to operate in */
  teamAllowedPaths: Schema.optional(Schema.Array(Schema.String)),
  /** Session-level permission overrides */
  sessionPermission: Schema.optional(Schema.Array(Schema.String)),
  /** Team members (1-8) */
  members: Schema.Array(Member),
})
export type TeamSpec = Schema.Schema.Type<typeof TeamSpec>

// ── Message ────────────────────────────────────────────────────────────

/** A message sent between team members */
export const Message = Schema.Struct({
  version: Schema.Literal(1),
  messageId: MessageId,
  from: Schema.String,
  to: Schema.String,
  kind: MessageKind,
  /** Message body text (max 32KB) */
  body: Schema.String.pipe(Schema.check(Schema.isMaxLength(32768))),
  /** Optional short summary for inbox listing */
  summary: Schema.optional(Schema.String),
  /** Message references (e.g., task IDs, message IDs being replied to) */
  references: Schema.optional(Schema.Array(Schema.String)),
  /** When the message was sent */
  timestamp: DateTimeUtcFromMillis,
  /** Correlation ID for grouping related messages */
  correlationId: Schema.optional(Schema.String),
  /** Display color hint */
  color: Schema.optional(Schema.String),
})
export type Message = Schema.Schema.Type<typeof Message>

// ── Task ───────────────────────────────────────────────────────────────

/** A task on the shared team tasklist */
export const Task = Schema.Struct({
  version: Schema.Literal(1),
  id: TaskId,
  subject: Schema.String,
  description: Schema.optional(Schema.String),
  /** Current status */
  status: TaskStatus,
  /** Current owner (member name) */
  owner: Schema.optional(Schema.String),
  /** Task IDs that this task blocks */
  blocks: Schema.optional(Schema.Array(TaskId)),
  /** Task IDs that block this task */
  blockedBy: Schema.optional(Schema.Array(TaskId)),
  /** Arbitrary metadata */
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  createdAt: DateTimeUtcFromMillis,
  updatedAt: DateTimeUtcFromMillis,
  claimedAt: Schema.optional(DateTimeUtcFromMillis),
})
export type Task = Schema.Schema.Type<typeof Task>

// ── Runtime State ──────────────────────────────────────────────────────

/** A member's runtime state within a team run */
export const RuntimeStateMember = Schema.Struct({
  name: Schema.String,
  /** Session ID once the member session is spawned */
  sessionId: Schema.optional(Schema.String),
  /** Tmux pane ID for visualization */
  tmuxPaneId: Schema.optional(Schema.String),
  /** Grid pane ID for tmux layout */
  tmuxGridPaneId: Schema.optional(Schema.String),
  /** Member role */
  agentType: MemberRole,
  /** Subagent type if kind was subagent_type */
  subagentType: Schema.optional(Schema.String),
  /** Category if kind was category */
  category: Schema.optional(Schema.String),
  /** Model override */
  model: Schema.optional(Schema.String),
  /** Current operational status */
  status: MemberStatus,
  /** Display color */
  color: Schema.optional(Schema.String),
  /** Git worktree path if one was created */
  worktreePath: Schema.optional(Schema.String),
  /** Last injected turn marker for mailbox polling */
  lastInjectedTurnMarker: Schema.optional(Schema.String),
  /** Message IDs that have been dispatched but not yet acked */
  pendingInjectedMessageIds: Schema.optional(Schema.Array(Schema.String)),
})
export type RuntimeStateMember = Schema.Schema.Type<typeof RuntimeStateMember>

/** A shutdown request from a team member */
export const ShutdownRequest = Schema.Struct({
  from: Schema.String,
  reason: Schema.optional(Schema.String),
  timestamp: DateTimeUtcFromMillis,
})
export type ShutdownRequest = Schema.Schema.Type<typeof ShutdownRequest>

/** Runtime bounds tracking */
export const RuntimeBounds = Schema.Struct({
  messagesSent: Schema.Int,
  wallClockStarted: Schema.optional(DateTimeUtcFromMillis),
  totalMemberTurns: Schema.Int,
})
export type RuntimeBounds = Schema.Schema.Type<typeof RuntimeBounds>

/** Full runtime state for a team run */
export const RuntimeState = Schema.Struct({
  version: Schema.Literal(1),
  teamRunId: TeamRunId,
  teamName: TeamName,
  /** Whether the spec came from project or user config */
  specSource: Schema.Literals(["project", "user"]),
  createdAt: DateTimeUtcFromMillis,
  /** Current run status */
  status: RuntimeStatus,
  /** The lead member's session ID */
  leadSessionId: Schema.optional(Schema.String),
  /** Tmux layout name if visualization is active */
  tmuxLayout: Schema.optional(Schema.String),
  /** Member runtime states */
  members: Schema.Array(RuntimeStateMember),
  /** Active shutdown requests */
  shutdownRequests: Schema.Array(ShutdownRequest),
  /** Runtime bounds tracking */
  bounds: RuntimeBounds,
})
export type RuntimeState = Schema.Schema.Type<typeof RuntimeState>

// ── Agent Eligibility ─────────────────────────────────────────────────

export type EligibilityVerdict = "eligible" | "conditional" | "hard-reject"

export type EligibilityEntry = {
  verdict: EligibilityVerdict
  rejectionMessage?: string
}

/**
 * Registry of which agent types can participate as team members.
 *
 * - `eligible`: Full team member participation
 * - `conditional`: Eligible but requires additional permissions or config
 * - `hard-reject`: Read-only agents that cannot be team members
 */
export const AGENT_ELIGIBILITY_REGISTRY: Readonly<Record<string, EligibilityEntry>> = {
  ghost: { verdict: "eligible" },
  sisyphus: { verdict: "eligible" },
  atlas: { verdict: "eligible" },
  "sisyphus-junior": { verdict: "eligible" },
  hephaestus: {
    verdict: "conditional",
    rejectionMessage:
      'Hephaestus requires D-36 permission patch for teammate mode. Use subagent_type: sisyphus instead.',
  },
  oracle: {
    verdict: "hard-reject",
    rejectionMessage:
      "Oracle is a read-only consultant and cannot be a team member. Use task/delegate-task instead.",
  },
  librarian: {
    verdict: "hard-reject",
    rejectionMessage:
      "Librarian is a read-only researcher and cannot be a team member. Use task/delegate-task instead.",
  },
  explore: {
    verdict: "hard-reject",
    rejectionMessage:
      "Explore is a read-only explorer and cannot be a team member. Use task/delegate-task instead.",
  },
  multimodalLooker: {
    verdict: "hard-reject",
    rejectionMessage:
      "Multimodal-Looker is a read-only analyzer and cannot be a team member.",
  },
  metis: {
    verdict: "hard-reject",
    rejectionMessage:
      "Metis is a pre-planning consultant and cannot be a team member.",
  },
  momus: {
    verdict: "hard-reject",
    rejectionMessage:
      "Momus is a plan reviewer and cannot be a team member.",
  },
  prometheus: {
    verdict: "hard-reject",
    rejectionMessage:
      "Prometheus is a strategic planner and cannot be a team member.",
  },
}

// ── Error Types ────────────────────────────────────────────────────────

export class MemberValidationError extends Schema.TaggedErrorClass<MemberValidationError>()(
  "TeamMemberValidationError",
  {
    name: Schema.String,
    issue: Schema.String,
  },
) {}

export class AgentNotEligibleError extends Schema.TaggedErrorClass<AgentNotEligibleError>()(
  "TeamAgentNotEligibleError",
  {
    agentType: Schema.String,
    message: Schema.String,
  },
) {}

export class MemberCountError extends Schema.TaggedErrorClass<MemberCountError>()(
  "TeamMemberCountError",
  {
    count: Schema.Int,
    max: Schema.Int,
    min: Schema.Int,
  },
) {}

// ── Runtime State Transitions ──────────────────────────────────────────

/**
 * Valid runtime state transitions.
 * Maps current status -> allowed next statuses.
 */
export const RUNTIME_STATE_TRANSITIONS: Readonly<
  Record<RuntimeStatus, ReadonlyArray<RuntimeStatus>>
> = {
  creating: ["active", "failed"],
  active: ["shutdown_requested", "deleting"],
  shutdown_requested: ["deleting"],
  deleting: ["deleted"],
  deleted: [],
  failed: [],
  orphaned: [],
}

/**
 * Valid task status transitions.
 */
export const TASK_STATUS_TRANSITIONS: Readonly<
  Record<TaskStatus, ReadonlyArray<TaskStatus>>
> = {
  pending: ["claimed", "deleted"],
  claimed: ["in_progress", "deleted"],
  in_progress: ["completed", "deleted"],
  completed: ["deleted"],
  deleted: [],
}

/**
 * Check if a runtime state transition is valid.
 */
export function isValidRuntimeTransition(
  from: RuntimeStatus,
  to: RuntimeStatus,
): boolean {
  return RUNTIME_STATE_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Check if a task status transition is valid.
 */
export function isValidTaskTransition(
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  return TASK_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}
