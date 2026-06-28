import { Effect, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { assertExternalDirectoryEffect } from "./external-directory"
import * as Tool from "./tool"

/**
 * AST-Grep tool — Pattern-aware code search using ast-grep (sg).
 * Requires the `sg` binary on PATH.
 */

function runSg(args: string[], cwd: string): Effect.Effect<string> {
  return Effect.promise<string>(() =>
    (async () => {
      // @ts-ignore - Bun API available at runtime
      const process = Bun.spawn(["sg", ...args], { cwd })
      const output = await new Response(process.stdout).text()
      const exitCode = await process.exited
      return exitCode === 0 ? output.trim() : `sg exited with code ${exitCode}`
    })(),
  ).pipe(Effect.catch(() => Effect.succeed("ast-grep (sg) not found on PATH. Install: brew install ast-grep")))
}

function checkSg(): Effect.Effect<boolean> {
  return Effect.promise<boolean>(() =>
    (async () => {
      // @ts-ignore - Bun API available at runtime
      const process = Bun.spawn(["sg", "--version"], { stdio: "ignore" })
      const exitCode = await process.exited
      return exitCode === 0
    })(),
  ).pipe(Effect.catch(() => Effect.succeed(false)))
}

export const AstGrepSearchTool = Tool.define(
  "ast_grep_search",
  Effect.gen(function* () {
    return {
      description: [
        "Search code using AST-level pattern matching with ast-grep (sg).",
        "Unlike grep, ast-grep understands code structure.",
        "Example: `console.log($_)` finds all console.log calls.",
        "Requires `sg` binary. Install: brew install ast-grep",
      ].join("\n"),
      parameters: Schema.Struct({
        pattern: Schema.String.annotate({
          description: "AST pattern. Meta-variables: $_ single, $$$ multi, $NAME named. Example: `console.log($_)`",
        }),
        path: Schema.optional(Schema.String).annotate({ description: "Directory to search. Defaults to cwd." }),
        language: Schema.optional(Schema.String).annotate({ description: "AST language (ts, js, py, rs, go). Auto-detected." }),
      }),
      execute: (params: { pattern: string; path?: string; language?: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({ permission: "bash", patterns: [], always: ["*"], metadata: { tool: "ast_grep_search" } })
          const ins = yield* InstanceState.context
          const searchDir = params.path ?? ins.directory
          yield* assertExternalDirectoryEffect(ctx, searchDir, { bypass: false, kind: "directory" })

          const available = yield* checkSg()
          if (!available) {
            return {
              title: "ast-grep not found",
              metadata: {},
              output: "ast-grep (sg) not found on PATH. Install: brew install ast-grep",
            }
          }

          const args = ["run", "-p", params.pattern]
          if (params.language) args.push("--lang", params.language)
          const output = yield* runSg(args, searchDir)

          const lines = output.split("\n").filter(Boolean)
          return {
            title: lines.length > 0 ? `ast-grep: ${lines.length} match${lines.length > 1 ? "es" : ""}` : "ast-grep: no matches",
            metadata: {},
            output: output || "No matches found.",
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export const AstGrepRewriteTool = Tool.define(
  "ast_grep_rewrite",
  Effect.gen(function* () {
    return {
      description: [
        "Rewrite code using AST-level pattern matching with ast-grep (sg).",
        "Finds all AST pattern matches and rewrites using a template.",
        "Example: pattern=`console.log($MSG)` rewrite=`console.debug($MSG)`",
      ].join("\n"),
      parameters: Schema.Struct({
        pattern: Schema.String.annotate({ description: "AST pattern to match." }),
        rewrite: Schema.String.annotate({ description: "Rewrite template with meta-variables." }),
        path: Schema.optional(Schema.String).annotate({ description: "Directory to rewrite." }),
        language: Schema.optional(Schema.String).annotate({ description: "AST language." }),
      }),
      execute: (params: { pattern: string; rewrite: string; path?: string; language?: string }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({ permission: "edit", patterns: [], always: ["*"], metadata: { tool: "ast_grep_rewrite" } })
          const ins = yield* InstanceState.context
          const searchDir = params.path ?? ins.directory
          yield* assertExternalDirectoryEffect(ctx, searchDir, { bypass: false, kind: "directory" })

          const available = yield* checkSg()
          if (!available) {
            return {
              title: "ast-grep not found",
              metadata: {},
              output: "ast-grep (sg) not found on PATH. Install: brew install ast-grep",
            }
          }

          const args = ["run", "-p", params.pattern, "-r", params.rewrite]
          if (params.language) args.push("--lang", params.language)
          const output = yield* runSg(args, searchDir)

          return { title: "ast-grep rewrite applied", metadata: {}, output: output || "Rewrite completed." }
        }).pipe(Effect.orDie),
    }
  }),
)
