export * as ConfigTeam from "./team"

import { Schema } from "effect"

/**
 * Team mode configuration sub-schema.
 *
 * Maps to @talon-ai/team-core's TeamModeConfig for Effect-native
 * multi-agent team coordination.
 */
export class Info extends Schema.Class<Info>("ConfigV2.Team")({
  /** Master switch for team mode functionality */
  enabled: Schema.Boolean.pipe(Schema.optional).annotate({
    description: "Enable team-based multi-agent orchestration",
  }),
  /** Maximum number of members that can run in parallel (1-8) */
  max_parallel_members: Schema.Int.pipe(Schema.optional).annotate({
    description: "Maximum parallel team members (1-8)",
  }),
  /** Hard cap on total team members (1-8) */
  max_members: Schema.Int.pipe(Schema.optional).annotate({
    description: "Maximum total team members (1-8)",
  }),
  /** Visual tmux pane grid showing team members */
  tmux_visualization: Schema.Boolean.pipe(Schema.optional).annotate({
    description: "Visual tmux pane layout showing team members",
  }),
  /** Maximum total messages allowed per team run */
  max_messages_per_run: Schema.Int.pipe(Schema.optional).annotate({
    description: "Maximum total messages per team run",
  }),
  /** Maximum wall clock time in minutes before forced shutdown */
  max_wall_clock_minutes: Schema.Int.pipe(Schema.optional).annotate({
    description: "Maximum wall clock minutes per team run",
  }),
  /** Maximum turns any single member can take */
  max_member_turns: Schema.Int.pipe(Schema.optional).annotate({
    description: "Maximum turns per team member",
  }),
  /** Override base directory for team storage */
  base_dir: Schema.String.pipe(Schema.optional).annotate({
    description: "Override base directory for team storage",
  }),
  /** Maximum message payload size in bytes */
  message_payload_max_bytes: Schema.Int.pipe(Schema.optional).annotate({
    description: "Maximum message payload size in bytes",
  }),
  /** Maximum unread bytes per recipient before backpressure */
  recipient_unread_max_bytes: Schema.Int.pipe(Schema.optional).annotate({
    description: "Maximum unread bytes before backpressure",
  }),
  /** Mailbox polling interval in milliseconds */
  mailbox_poll_interval_ms: Schema.Int.pipe(Schema.optional).annotate({
    description: "Mailbox polling interval in milliseconds",
  }),
}) {}
