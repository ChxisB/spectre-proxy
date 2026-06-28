export * as WisdomTool from "./wisdom"

import { ToolFailure } from "@talon-ai/llm"
import { Effect, Layer, Schema } from "effect"
import { PermissionV2 } from "@talon-ai/core/permission"
import { WisdomService } from "@talon-ai/core/wisdom/service"
import { WisdomExtractor } from "@talon-ai/core/wisdom/extractor"
import { Tool } from "@talon-ai/core/tool/tool"
import { Tools } from "@talon-ai/core/tool/tools"

export const name = "wisdom"

export const Input = Schema.Struct({
    action: Schema.Literals(["save", "query", "list"]),
  insight: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  query: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Number),
})

export const Output = Schema.Struct({
  entries: Schema.Array(Schema.Unknown),
  count: Schema.Number,
})
export type Output = typeof Output.Type

export const toModelOutput = (output: Output) => JSON.stringify({ count: output.count }, null, 2)

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const wisdom = yield* WisdomService.Service
    const permission = yield* PermissionV2.Service

    yield* tools
      .register({
        [name]: Tool.make({
          description:
            `Create and query accumulated wisdom from previous work sessions.\n` +
            `- "save": Record a learning/insight for future sessions\n` +
            `- "query": Find wisdom matching specific tags or text\n` +
            `- "list": List recent wisdom entries\n\n` +
            `Use this to avoid repeating past mistakes and leverage past learnings.`,
          input: Input,
          output: Output,
          toModelOutput: ({ output }) => [{ type: "text", text: toModelOutput(output) }],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* permission.assert({
                action: name,
                resources: ["*"],
                save: ["*"],
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
              })

              if (input.action === "save") {
                if (!input.insight) {
                  return {
                    entries: [],
                    count: 0,
                  }
                }
                const entry = yield* wisdom.add({
                  insight: input.insight,
                  source: "tool",
                  tags: input.tags ?? WisdomExtractor.generateTags(input.insight),
                  relevance: 1.0,
                })
                return { entries: [entry], count: 1 }
              }

              if (input.action === "query") {
                const results = yield* wisdom.query({
                  tags: input.tags,
                  limit: input.limit,
                })
                return { entries: results, count: results.length }
              }

              const results = yield* wisdom.query({
                limit: input.limit ?? 20,
              })
              return { entries: results, count: results.length }
            }).pipe(Effect.mapError(() => new ToolFailure({ message: "Unable to process wisdom action" }))),
        }),
      })
      .pipe(Effect.orDie)
  }),
)
