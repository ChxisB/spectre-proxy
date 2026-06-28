/**
 * Interactive Bash tool — provides an interactive terminal via tmux.
 * Only available when running inside a tmux session.
 */

import { Effect, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import * as Tool from "./tool"

const Parameters = Schema.Struct({
  command: Schema.String.annotate({
    description: "The command to run (e.g., 'node', 'python', 'bash')",
  }),
  horizontal: Schema.optional(Schema.Boolean).annotate({
    description: "Split horizontally instead of vertically. Default: vertical.",
  }),
})

function tmux(args: string[]): Effect.Effect<string> {
  return Effect.promise<string>(() =>
    (async () => {
      const process = Bun.spawn(["tmux", ...args], { stdout: "pipe", stderr: "pipe" })
      const output = await new Response(process.stdout).text()
      await process.exited
      return output.trim()
    })(),
  ).pipe(Effect.catch(() => Effect.succeed("")))
}

export const InteractiveBashTool = Tool.define(
  "interactive_bash",
  Effect.succeed({
    description: [
      "Open an interactive terminal session using tmux.",
      "Use this for REPLs, debuggers, TUIs, or any command needing interactive input.",
      "Only works when running inside a tmux session.",
    ].join("\n"),
    parameters: Parameters,
    execute: (params: { readonly command: string; readonly horizontal?: boolean }, ctx: Tool.Context) =>
      Effect.gen(function* () {
        yield* ctx.ask({
          permission: "bash", patterns: [], always: ["*"],
          metadata: { tool: "interactive_bash", command: params.command },
        })

        if (!process.env.TMUX) {
          return {
            title: "Not in tmux", metadata: {},
            output: "interactive_bash requires running inside a tmux session. Start tmux first.",
          }
        }

        const args = ["split-window", "-P", "-F", "#{pane_id}"]
        if (params.horizontal) args.push("-h")
        else args.push("-v")
        args.push("-l", "60", params.command)

        const paneId = yield* tmux(args).pipe(Effect.catch(() => Effect.succeed("")))

        if (!paneId) {
          return { title: "Failed to create pane", metadata: {}, output: "Could not create tmux pane." }
        }

        return {
          title: `Interactive: ${params.command}`,
          metadata: {},
          output: `Started in tmux pane ${paneId}. Command: ${params.command}`,
        }
      }),
  }),
)
