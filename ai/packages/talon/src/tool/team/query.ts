import { Effect, Schema } from "effect"
import * as Tool from "../tool"
import { TeamStatusParams, TeamListParams } from "./types"

// ── Team Status ─────────────────────────────────────────────────────────

export const TeamStatusTool = Tool.define(
  "team_status",
  Effect.gen(function* () {
    return {
      description: [
        `Get the current status of a team or all teams.`,
        `Shows member states (running, idle, errored, completed),`,
        `task counts (pending, in-progress, completed),`,
        `and unread message counts for each member.`,
        ``,
        `If 'name' is omitted, shows status for all active teams.`,
      ].join("\n"),
      parameters: TeamStatusParams,
      execute: (params: Schema.Schema.Type<typeof TeamStatusParams>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_status",
            patterns: params.name ? [params.name] : [],
            always: ["*"],
            metadata: { teamName: params.name },
          })

          // TODO: Query team runtime state

          const teamRef = params.name ?? "all teams"
          return {
            title: `Status for ${teamRef}`,
            metadata: { teamName: params.name },
            output: [
              `Team status for ${teamRef}:`,
              ``,
              `  (No active teams. Use team_create to start a team.)`,
            ].join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)

// ── Team List ───────────────────────────────────────────────────────────

export const TeamListTool = Tool.define(
  "team_list",
  Effect.gen(function* () {
    return {
      description: [
        `List all declared and active teams.`,
        `Shows team names, member counts, and current status.`,
        `Use team_status <name> for detailed info on a specific team.`,
      ].join("\n"),
      parameters: TeamListParams,
      execute: (_params: {}, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_list",
            patterns: [],
            always: ["*"],
            metadata: {},
          })

          // TODO: Query active teams from team registry

          return {
            title: "Teams",
            metadata: {},
            output: [
              `Available teams:`,
              `  (No teams created yet. Use team_create to define a team.)`,
            ].join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
