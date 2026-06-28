import { Schema } from "effect"

/**
 * Team Mode configuration schema.
 *
 * Ported from oh-my-openagent's TeamModeConfigSchema.
 * Uses Effect Schema instead of Zod.
 */
export const TeamModeConfig = Schema.Struct({
  /** Master switch for team mode functionality */
  enabled: Schema.optional(Schema.Boolean),

  /** Visual tmux pane grid showing team members */
  tmuxVisualization: Schema.optional(Schema.Boolean),

  /** Maximum number of members that can run in parallel (1-8) */
  maxParallelMembers: Schema.optional(
    Schema.Int.pipe(
      Schema.check(Schema.isBetween({ minimum: 1, maximum: 8 })),
    ),
  ),

  /** Hard cap on total team members (1-8) */
  maxMembers: Schema.optional(
    Schema.Int.pipe(
      Schema.check(Schema.isBetween({ minimum: 1, maximum: 8 })),
    ),
  ),

  /** Maximum total messages allowed per team run */
  maxMessagesPerRun: Schema.optional(
    Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))),
  ),

  /** Maximum wall clock time in minutes before forced shutdown */
  maxWallClockMinutes: Schema.optional(
    Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))),
  ),

  /** Maximum turns any single member can take */
  maxMemberTurns: Schema.optional(
    Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))),
  ),

  /** Override base directory for team storage (default: ~/.talon/teams) */
  baseDir: Schema.optional(Schema.String),

  /** Maximum message payload size in bytes (minimum 1KB) */
  messagePayloadMaxBytes: Schema.optional(
    Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1024))),
  ),

  /** Maximum unread bytes per recipient before backpressure (minimum 1KB) */
  recipientUnreadMaxBytes: Schema.optional(
    Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1024))),
  ),

  /** How often to poll the mailbox for new messages in milliseconds (minimum 500ms) */
  mailboxPollIntervalMs: Schema.optional(
    Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(500))),
  ),
})

export type TeamModeConfig = Schema.Schema.Type<typeof TeamModeConfig>

/** Default team mode config values */
export const defaultTeamModeConfig: TeamModeConfig = {
  enabled: false,
  tmuxVisualization: false,
  maxParallelMembers: 4,
  maxMembers: 8,
  maxMessagesPerRun: 10000,
  maxWallClockMinutes: 120,
  maxMemberTurns: 500,
  messagePayloadMaxBytes: 32768,
  recipientUnreadMaxBytes: 262144,
  mailboxPollIntervalMs: 3000,
}

/**
 * Merge a partial team mode config with defaults.
 * Returns a fully populated TeamModeConfig.
 */
export function mergeTeamModeConfig(
  partial?: Partial<TeamModeConfig>,
): TeamModeConfig {
  return {
    ...defaultTeamModeConfig,
    ...partial,
  }
}
