import * as Tool from "./tool"
import DESCRIPTION from "./workflow.txt"
import { Effect, Schema } from "effect"

const WorkflowStepSchema = Schema.Struct({
  name: Schema.String,
  agent: Schema.String,
  task: Schema.String,
  dependsOn: Schema.optional(Schema.Array(Schema.String)),
})

export const Parameters = Schema.Struct({
  name: Schema.String.annotate({ description: "A short name for the workflow" }),
  description: Schema.optional(Schema.String).annotate({ description: "Optional description of the workflow goal" }),
  steps: Schema.Array(WorkflowStepSchema).annotate({
    description: "Ordered list of steps. Steps without dependsOn run in parallel. dependsOn references step names.",
  }),
})

/**
 * Workflow tool — allows LLM agents to decompose complex tasks into
 * parallel and sequential steps, each delegated to a specialist agent.
 * The tool returns a sorted plan with dependency context; the agent
 * then executes each step using the task tool.
 */
export const WorkflowTool = Tool.define(
  "workflow",
  Effect.gen(function* () {
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          // Build a sorted plan with dependency context
          const stepMap = new Map(params.steps.map((s) => [s.name, s]))
          const outputs = new Map<string, string>()

          // Topological sort: steps without dependsOn form the first batch
          type Step = (typeof params.steps)[number]
          const batches: Step[][] = []
          let remaining = new Set(params.steps.map((s) => s.name))

          while (remaining.size > 0) {
            const batch: Step[] = []
            for (const name of remaining) {
              const step = stepMap.get(name)
              if (!step) continue
              const deps = step.dependsOn ?? []
              if (!deps.some((dep) => remaining.has(dep))) {
                batch.push(step)
              }
            }
            if (batch.length === 0) break
            batches.push(batch)
            for (const s of batch) remaining.delete(s.name)
          }

          // Format the sorted plan as output
          const lines: string[] = [
            `# Workflow: ${params.name}`,
            "",
            ...(params.description ? [params.description, ""] : []),
            "## Execution Plan",
            "",
          ]

          for (let i = 0; i < batches.length; i++) {
            const batch = batches[i]
            const parallel = batch.length > 1
            lines.push(parallel ? `### Batch ${i + 1} (PARALLEL — ${batch.length} steps):` : `### Step ${i + 1}:`)
            for (const step of batch) {
              const context = (step.dependsOn ?? [])
                .map((dep) => outputs.get(dep))
                .filter(Boolean)
              const ctxNote = context.length > 0 ? ` [context: ${step.dependsOn!.join(", ")}]` : ""
              lines.push(`- **${step.name}** → agent: ${step.agent}${ctxNote}`)
              lines.push(`  ${step.task.split("\n")[0]}`)
            }
            lines.push("")
          }

          lines.push("## How to execute")
          lines.push("Execute each step by calling the `task` tool with the appropriate agent and task description.")
          lines.push("Steps in the same batch can run concurrently — they are independent of each other.")
          lines.push("Pass the output of upstream steps as context to downstream steps.")

          return {
            title: `workflow: ${params.name}`,
            metadata: {
              batches: batches.length,
              totalSteps: params.steps.length,
              parallelBatches: batches.filter((b) => b.length > 1).length,
            },
            output: lines.join("\n").trim(),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
