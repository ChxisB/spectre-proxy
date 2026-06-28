export * as EvidenceTool from "./evidence"

import { ToolFailure } from "@talon-ai/llm"
import { Effect, Layer, Schema } from "effect"
import { PermissionV2 } from "../permission"
import { Tool } from "./tool"
import { Tools } from "./tools"
import { ensureEvidenceDir, generateEvidenceDirName, listEvidence, writeEvidenceFile } from "../evidence/manager"
import { verifyEvidenceGate, formatEvidenceStatus } from "../evidence/verifier"

export const name = "evidence"

export const Input = Schema.Struct({
  action: Schema.Literals(["save", "list", "status"]),
  title: Schema.optional(Schema.String),
  goal: Schema.optional(Schema.String),
  scenarios: Schema.optional(
    Schema.Array(
      Schema.Struct({
        name: Schema.String,
        category: Schema.String,
        passCondition: Schema.String,
        status: Schema.String,
        assertionMessage: Schema.String,
        surfaceArtifact: Schema.optional(Schema.String),
      }),
    ),
  ),
  filesChanged: Schema.optional(Schema.Array(Schema.String)),
})

export const Output = Schema.Struct({
  success: Schema.Boolean,
  path: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
})
export type Output = typeof Output.Type

export const toModelOutput = (output: Output) => JSON.stringify({ success: output.success, summary: output.summary }, null, 2)

const projectRoot = () => process.cwd()

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const permission = yield* PermissionV2.Service

    yield* tools
      .register({
        [name]: Tool.make({
          description:
            "Record quality assurance evidence for completed work. Use evidence to save scenario results, test output, and surface artifacts.",
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
                if (!input.title || !input.goal) {
                  return { success: false, error: "title and goal are required for save action" }
                }

                const dirName = generateEvidenceDirName(input.title)
                const ts = Date.now()
                const scenarios = (input.scenarios ?? []).map((s) => ({
                  name: s.name,
                  category: s.category as "happy" | "edge" | "regression",
                  passCondition: s.passCondition,
                  status: s.status as "pass" | "fail" | "pending" | "blocked",
                  assertionMessage: s.assertionMessage,
                  surfaceArtifact: s.surfaceArtifact,
                  capturedAt: ts,
                }))

                const totalScenarios = scenarios.length
                const passedScenarios = scenarios.filter((s) => s.status === "pass").length
                const failedScenarios = scenarios.filter((s) => s.status === "fail").length

                const entry = {
                  id: dirName,
                  sessionID: context.sessionID,
                  title: input.title,
                  goal: input.goal,
                  scenarios,
                  totalScenarios,
                  passedScenarios,
                  failedScenarios,
                  filesChanged: input.filesChanged,
                  createdAt: ts,
                  completedAt: ts,
                }

                const filePath = yield* Effect.promise(() =>
                  ensureEvidenceDir(projectRoot()).then(() =>
                    writeEvidenceFile(projectRoot(), dirName, entry as any),
                  ),
                )

                return {
                  success: true,
                  path: filePath,
                  summary: `Saved evidence: ${dirName} (${passedScenarios}/${totalScenarios} passed)`,
                }
              }

              if (input.action === "list") {
                const entries = yield* Effect.promise(() => listEvidence(projectRoot(), 10))
                const summary = entries
                  .map((e) => {
                    const millis = typeof e.createdAt === "object" && e.createdAt !== null && "millis" in e.createdAt
                      ? (e.createdAt as { millis: number }).millis
                      : Date.now()
                    return `- ${e.title}: ${e.passedScenarios}/${e.totalScenarios} passed (${new Date(millis).toISOString().slice(0, 10)})`
                  })
                  .join("\n")
                return { success: true, summary: summary || "No evidence found." }
              }

              if (input.action === "status") {
                const result = yield* Effect.promise(() => verifyEvidenceGate(projectRoot(), { mode: "warn" }))
                return {
                  success: true,
                  summary: formatEvidenceStatus(result),
                }
              }

              return { success: false, error: `Unknown action: ${input.action}` }
            }).pipe(Effect.mapError(() => new ToolFailure({ message: "Unable to record evidence" }))),
        }),
      })
      .pipe(Effect.orDie)
  }),
)
