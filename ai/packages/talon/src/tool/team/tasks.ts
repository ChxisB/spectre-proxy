import { Effect, Schema } from "effect"
import * as Tool from "../tool"
import {
  TeamTaskCreateParams,
  TeamTaskListParams,
  TeamTaskUpdateParams,
  TeamTaskGetParams,
} from "./types"

// ── Team Task Create ────────────────────────────────────────────────────

export const TeamTaskCreateTool = Tool.define(
  "team_task_create",
  Effect.gen(function* () {
    return {
      description: [
        `Create a new task on the team's shared tasklist.`,
        `Tasks are visible to all team members and can be claimed and completed.`,
        `Use this to delegate work items to specific members or create`,
        `tasks that any available member can pick up.`,
        ``,
        `Tasks can have dependencies tracked via team_task_update.`,
      ].join("\n"),
      parameters: TeamTaskCreateParams,
      execute: (params: Schema.Schema.Type<typeof TeamTaskCreateParams>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_task_create",
            patterns: [params.name],
            always: ["*"],
            metadata: { teamName: params.name, subject: params.subject },
          })

          // TODO: Write task to team tasklist

          return {
            title: `Task created: ${params.subject}`,
            metadata: {
              teamName: params.name,
              subject: params.subject,
              taskId: `task_${Date.now()}`,
            },
            output: [
              `Task created in team "${params.name}":`,
              `  Subject: ${params.subject}`,
              params.description ? `  Description: ${params.description}` : "",
              `  Status: pending`,
              ``,
              `Members can claim this task via team_task_update.`,
            ]
              .filter(Boolean)
              .join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ── Team Task List ──────────────────────────────────────────────────────

export const TeamTaskListTool = Tool.define(
  "team_task_list",
  Effect.gen(function* () {
    return {
      description: [
        `List tasks on the team's shared tasklist.`,
        `Optionally filter by status to see only pending, in-progress,`,
        `or completed tasks.`,
      ].join("\n"),
      parameters: TeamTaskListParams,
      execute: (params: Schema.Schema.Type<typeof TeamTaskListParams>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_task_list",
            patterns: [params.name],
            always: ["*"],
            metadata: { teamName: params.name, status: params.status },
          })

          // TODO: Read from team tasklist

          const filterStr = params.status ? ` (filtered: ${params.status})` : ""
          return {
            title: `Tasks for team "${params.name}"${filterStr}`,
            metadata: { teamName: params.name, status: params.status },
            output: `Task list for team "${params.name}"${filterStr}:\n  (no tasks yet — use team_task_create to add tasks)`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ── Team Task Update ────────────────────────────────────────────────────

export const TeamTaskUpdateTool = Tool.define(
  "team_task_update",
  Effect.gen(function* () {
    return {
      description: [
        `Update a task's status on the team tasklist.`,
        `Valid transitions: pending -> claimed -> in_progress -> completed,`,
        `or any status -> deleted.`,
        ``,
        `Use 'claimed' to assign the task to yourself,`,
        `'in_progress' when actively working,`,
        `'completed' when done, and 'deleted' to remove.`,
      ].join("\n"),
      parameters: TeamTaskUpdateParams,
      execute: (params: Schema.Schema.Type<typeof TeamTaskUpdateParams>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_task_update",
            patterns: [params.name],
            always: ["*"],
            metadata: { teamName: params.name, taskId: params.taskId, status: params.status },
          })

          // TODO: Update task in tasklist

          return {
            title: `Task ${params.taskId} updated to ${params.status}`,
            metadata: {
              teamName: params.name,
              taskId: params.taskId,
              status: params.status,
            },
            output: `Task ${params.taskId} in team "${params.name}" is now ${params.status}.`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ── Team Task Get ───────────────────────────────────────────────────────

export const TeamTaskGetTool = Tool.define(
  "team_task_get",
  Effect.gen(function* () {
    return {
      description: [
        `Get details of a single task on the team tasklist by its ID.`,
        `Shows the task subject, description, status, owner, and any`,
        `dependency information.`,
      ].join("\n"),
      parameters: TeamTaskGetParams,
      execute: (params: Schema.Schema.Type<typeof TeamTaskGetParams>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_task_get",
            patterns: [params.name],
            always: ["*"],
            metadata: { teamName: params.name, taskId: params.taskId },
          })

          // TODO: Read single task from tasklist

          return {
            title: `Task ${params.taskId}`,
            metadata: { teamName: params.name, taskId: params.taskId },
            output: `Task ${params.taskId} in team "${params.name}": (details not yet available)`,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
