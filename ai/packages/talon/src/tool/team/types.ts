import { Schema } from "effect"

/**
 * Shared parameter schemas for team tools.
 */

/** Parameters for team_create */
export const TeamCreateParams = Schema.Struct({
  name: Schema.String.annotate({
    description: "Team name for discovery and reference",
  }),
  description: Schema.optional(Schema.String).annotate({
    description: "Description of the team's purpose",
  }),
  members: Schema.Array(
    Schema.Struct({
      name: Schema.String.annotate({
        description: "Member name within the team",
      }),
      /** Member definition: either a category or a subagent_type */
      kind: Schema.Literals(["category", "subagent_type"]).annotate({
        description:
          '"category" for a category-routed member, "subagent_type" for a direct agent',
      }),
      category: Schema.optional(Schema.String).annotate({
        description: "Category name (required when kind=category)",
      }),
      subagentType: Schema.optional(Schema.String).annotate({
        description: "Agent name (required when kind=subagent_type)",
      }),
      prompt: Schema.optional(Schema.String).annotate({
        description:
          "Optional system prompt or guidance for this member",
      }),
      color: Schema.optional(Schema.String).annotate({
        description: "Display color for this member",
      }),
    }),
  ).annotate({
    description: "Team members (1-8)",
  }),
})

/** Parameters for team_delete */
export const TeamDeleteParams = Schema.Struct({
  name: Schema.String.annotate({
    description: "Team name to delete",
  }),
})

/** Parameters for team_shutdown_request */
export const TeamShutdownRequestParams = Schema.Struct({
  name: Schema.String.annotate({
    description: "Team name",
  }),
  reason: Schema.optional(Schema.String).annotate({
    description: "Reason for shutdown request",
  }),
})

/** Parameters for team_approve_shutdown */
export const TeamApproveShutdownParams = Schema.Struct({
  name: Schema.String.annotate({
    description: "Team name",
  }),
  member: Schema.String.annotate({
    description: "Member whose shutdown to approve",
  }),
})

/** Parameters for team_reject_shutdown */
export const TeamRejectShutdownParams = Schema.Struct({
  name: Schema.String.annotate({
    description: "Team name",
  }),
  member: Schema.String.annotate({
    description: "Member whose shutdown to reject",
  }),
  reason: Schema.String.annotate({
    description: "Reason for rejection",
  }),
})

/** Parameters for team_send_message */
export const TeamSendMessageParams = Schema.Struct({
  name: Schema.String.annotate({
    description: "Team name",
  }),
  to: Schema.optional(Schema.String).annotate({
    description: "Recipient member name, or omit for broadcast to all members",
  }),
  body: Schema.String.annotate({
    description: "Message body text",
  }),
  summary: Schema.optional(Schema.String).annotate({
    description: "Optional short summary for inbox listing",
  }),
})

/** Parameters for team_task_create */
export const TeamTaskCreateParams = Schema.Struct({
  name: Schema.String.annotate({
    description: "Team name",
  }),
  subject: Schema.String.annotate({
    description: "Task subject / title",
  }),
  description: Schema.optional(Schema.String).annotate({
    description: "Task description",
  }),
})

/** Parameters for team_task_list */
export const TeamTaskListParams = Schema.Struct({
  name: Schema.String.annotate({
    description: "Team name",
  }),
  status: Schema.optional(
    Schema.Literals(["pending", "claimed", "in_progress", "completed", "deleted"]),
  ).annotate({
    description: "Filter by task status",
  }),
})

/** Parameters for team_task_update */
export const TeamTaskUpdateParams = Schema.Struct({
  name: Schema.String.annotate({
    description: "Team name",
  }),
  taskId: Schema.String.annotate({
    description: "Task ID to update",
  }),
  status: Schema.Literals(["claimed", "in_progress", "completed", "deleted"]).annotate({
    description: "New task status",
  }),
})

/** Parameters for team_task_get */
export const TeamTaskGetParams = Schema.Struct({
  name: Schema.String.annotate({
    description: "Team name",
  }),
  taskId: Schema.String.annotate({
    description: "Task ID to fetch",
  }),
})

/** Parameters for team_status */
export const TeamStatusParams = Schema.Struct({
  name: Schema.String.annotate({
    description: "Team name to query, or omit for all teams",
  }),
})

/** Parameters for team_list -- no params needed */
export const TeamListParams = Schema.Struct({})
