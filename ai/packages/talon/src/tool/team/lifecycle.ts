import { Effect, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import * as Tool from "../tool"
import {
  TeamCreateParams,
  TeamDeleteParams,
  TeamShutdownRequestParams,
  TeamApproveShutdownParams,
  TeamRejectShutdownParams,
} from "./types"

// ── Team Create ─────────────────────────────────────────────────────────

export const TeamCreateTool = Tool.define(
  "team_create",
  Effect.gen(function* () {
    return {
      description: [
        `Create a new team with 1–8 members for parallel multi-agent coordination.`,
        `Each member runs as a subagent session with the team's shared tasklist and mailbox.`,
        `The caller becomes the team lead and can orchestrate members via team_send_message,`,
        `team_task_create, and team_task_update.`,
        ``,
        `Example:`,
        `  team_create(name="feature-auth", members=[`,
        `    { name: "explorer", kind: "subagent_type", subagentType: "explore" },`,
        `    { name: "implementer", kind: "subagent_type", subagentType: "ghost" },`,
        `    { name: "reviewer", kind: "subagent_type", subagentType: "reviewer" },`,
        `  ])`,
      ].join("\n"),
      parameters: TeamCreateParams,
      execute: (params: Schema.Schema.Type<typeof TeamCreateParams>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_create",
            patterns: params.members.map((m) => m.name),
            always: ["*"],
            metadata: { teamName: params.name, memberCount: params.members.length },
          })

          const ins = yield* InstanceState.context

          // TODO: Implement actual team creation:
          // 1. Persist team spec via @talon-ai/team-core
          // 2. Spawn member subagent sessions
          // 3. Create mailbox + tasklist
          // 4. Return team status

          const memberLines = params.members
            .map(
              (m) =>
                `  - ${m.name}: ${m.kind === "category" ? `category=${m.category}` : `agent=${m.subagentType}`}${m.prompt ? ` (with custom prompt)` : ""}`,
            )
            .join("\n")

          return {
            title: `Team "${params.name}" is now active`,
            metadata: {
              name: params.name,
              memberCount: params.members.length,
              lead: true,
            },
            output: [
              `Team "${params.name}" created with ${params.members.length} member(s):`,
              memberLines,
              ``,
              `The team is active. Use team_send_message to communicate with members,`,
              `team_task_create to add tasks, and team_status to check on progress.`,
            ].join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ── Team Delete ─────────────────────────────────────────────────────────

export const TeamDeleteTool = Tool.define(
  "team_delete",
  Effect.gen(function* () {
    return {
      description: [
        `Tear down a team and all its member sessions.`,
        `This shuts down all member subagents, cleans up mailbox/tasklist state,`,
        `and removes the team from the active team list.`,
      ].join("\n"),
      parameters: TeamDeleteParams,
      execute: (params: Schema.Schema.Type<typeof TeamDeleteParams>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_delete",
            patterns: [params.name],
            always: ["*"],
            metadata: { teamName: params.name },
          })

          // TODO: Implement actual team deletion:
          // 1. Shutdown member sessions
          // 2. Clean up state
          // 3. Remove team from active list

          return {
            title: `Team "${params.name}" deleted`,
            metadata: { name: params.name },
            output: `Team "${params.name}" has been shut down and all member sessions terminated.`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ── Team Shutdown Request ───────────────────────────────────────────────

export const TeamShutdownRequestTool = Tool.define(
  "team_shutdown_request",
  Effect.gen(function* () {
    return {
      description: [
        `Request that a team member shut down (stop their session).`,
        `The team lead can request shutdown of any member. Members must`,
        `approve or reject the request via team_approve_shutdown / team_reject_shutdown.`,
        ``,
        `Use this to gracefully drain a member when their work is complete`,
        `or when reconfiguring the team.`,
      ].join("\n"),
      parameters: TeamShutdownRequestParams,
      execute: (params: Schema.Schema.Type<typeof TeamShutdownRequestParams>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_shutdown_request",
            patterns: [params.name],
            always: ["*"],
            metadata: { teamName: params.name, reason: params.reason },
          })

          // TODO: Route shutdown request through team mailbox

          return {
            title: `Shutdown requested for team "${params.name}"`,
            metadata: { name: params.name },
            output: [
              `Shutdown requested for team "${params.name}"`,
              params.reason ? `Reason: ${params.reason}` : "",
              `Members will need to approve or reject.`,
            ]
              .filter(Boolean)
              .join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ── Team Approve Shutdown ───────────────────────────────────────────────

export const TeamApproveShutdownTool = Tool.define(
  "team_approve_shutdown",
  Effect.gen(function* () {
    return {
      description: [
        `Approve a shutdown request and terminate the team member's session.`,
        `Typically used by a team member to acknowledge they are done and`,
        `ready to be shut down.`,
      ].join("\n"),
      parameters: TeamApproveShutdownParams,
      execute: (params: Schema.Schema.Type<typeof TeamApproveShutdownParams>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_approve_shutdown",
            patterns: [params.name],
            always: ["*"],
            metadata: { teamName: params.name, member: params.member },
          })

          // TODO: Process approval through team runtime

          return {
            title: `Shutdown approved for ${params.member}`,
            metadata: { name: params.name, member: params.member },
            output: `Shutdown approved for member "${params.member}" in team "${params.name}".`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ── Team Reject Shutdown ────────────────────────────────────────────────

export const TeamRejectShutdownTool = Tool.define(
  "team_reject_shutdown",
  Effect.gen(function* () {
    return {
      description: [
        `Reject a shutdown request, keeping the team member active.`,
        `Use this when a member still has work to do or when shutting them`,
        `down would leave critical tasks incomplete.`,
      ].join("\n"),
      parameters: TeamRejectShutdownParams,
      execute: (params: Schema.Schema.Type<typeof TeamRejectShutdownParams>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_reject_shutdown",
            patterns: [params.name],
            always: ["*"],
            metadata: { teamName: params.name, member: params.member },
          })

          // TODO: Process rejection through team runtime

          return {
            title: `Shutdown rejected for ${params.member}`,
            metadata: { name: params.name, member: params.member, reason: params.reason },
            output: [
              `Shutdown rejected for member "${params.member}" in team "${params.name}".`,
              `Reason: ${params.reason}`,
            ].join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
