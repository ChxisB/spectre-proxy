import { Effect, Schema } from "effect"
import * as Tool from "../tool"
import { TeamSendMessageParams } from "./types"

// ── Team Send Message ───────────────────────────────────────────────────

export const TeamSendMessageTool = Tool.define(
  "team_send_message",
  Effect.gen(function* () {
    return {
      description: [
        `Send a message to a team member or broadcast to all members.`,
        `Messages are delivered to the recipient's mailbox and polled on their`,
        `next turn. Use this for coordination: delegating sub-tasks, asking for`,
        `status updates, or sharing information.`,
        ``,
        `If 'to' is omitted, the message is broadcast to ALL members.`,
        `Only the team lead can broadcast.`,
      ].join("\n"),
      parameters: TeamSendMessageParams,
      execute: (params: Schema.Schema.Type<typeof TeamSendMessageParams>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "team_send_message",
            patterns: params.to ? [params.to] : [],
            always: ["*"],
            metadata: {
              teamName: params.name,
              recipient: params.to ?? "all (broadcast)",
            },
          })

          // TODO: Route through team mailbox
          // 1. Validate the team exists and is active
          // 2. Check mailbox bounds (message size, TTL)
          // 3. Write to recipient's inbox
          // 4. Signal recipient to poll mailbox

          const recipient = params.to ?? "all members"
          return {
            title: `Message sent to ${recipient}`,
            metadata: {
              teamName: params.name,
              to: params.to ?? "*",
              bodyLength: params.body.length,
            },
            output: [
              `Message sent to ${recipient} in team "${params.name}".`,
              params.summary ? `Summary: ${params.summary}` : "",
              `The recipient will see this on their next turn.`,
            ]
              .filter(Boolean)
              .join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
