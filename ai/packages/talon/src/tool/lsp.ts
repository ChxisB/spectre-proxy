import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import path from "path"
import { LSP } from "@/lsp/lsp"
import DESCRIPTION from "./lsp.txt"
import { InstanceState } from "@/effect/instance-state"
import { pathToFileURL } from "url"
import { assertExternalDirectoryEffect } from "./external-directory"
import { FSUtil } from "@talon-ai/core/fs-util"

const operations = [
  "status",
  "diagnostics",
  "goToDefinition",
  "findReferences",
  "hover",
  "documentSymbol",
  "workspaceSymbol",
  "goToImplementation",
  "prepareCallHierarchy",
  "incomingCalls",
  "outgoingCalls",
  "prepareRename",
  "rename",
] as const

const SeverityFilter = Schema.Literals(["error", "warning", "information", "hint", "all"] as const).annotate({
  description: "Filter diagnostics by severity. Defaults to all.",
})

export const Parameters = Schema.Struct({
  operation: Schema.Literals(operations).annotate({ description: "The LSP operation to perform" }),
  filePath: Schema.String.annotate({ description: "The absolute or relative path to the file" }),
  line: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))).annotate({
    description: "The line number (1-based, as shown in editors). Required for navigation operations.",
  }),
  character: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))).annotate({
    description: "The character offset (1-based, as shown in editors). Required for navigation operations.",
  }),
  query: Schema.optional(Schema.String).annotate({
    description: "Search query for workspaceSymbol. Empty string requests all symbols.",
  }),
  severity: Schema.optional(SeverityFilter),
  newName: Schema.optional(Schema.String).annotate({
    description: "The new name for the symbol. Required for rename operation.",
  }),
})

export const LspTool = Tool.define(
  "lsp",
  Effect.gen(function* () {
    const lsp = yield* LSP.Service
    const fs = yield* FSUtil.Service
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (args: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        (Effect.gen(function* () {
          const instance = yield* InstanceState.context
          const file = path.isAbsolute(args.filePath) ? args.filePath : path.join(instance.directory, args.filePath)
          yield* assertExternalDirectoryEffect(ctx, file)

          // Build permission metadata based on operation type
          const cursorOps = new Set(["goToDefinition", "findReferences", "hover", "goToImplementation", "prepareCallHierarchy", "incomingCalls", "outgoingCalls", "prepareRename", "rename"])
          const meta =
            args.operation === "workspaceSymbol"
              ? { operation: args.operation }
              : args.operation === "diagnostics"
                ? { operation: args.operation, filePath: file }
                : args.operation === "documentSymbol"
                  ? { operation: args.operation, filePath: file }
                  : { operation: args.operation, filePath: file, line: args.line, character: args.character }
          yield* ctx.ask({
            permission: "lsp",
            patterns: ["*"],
            always: ["*"],
            metadata: meta,
          })

          const uri = pathToFileURL(file).href
          const exists = yield* fs.existsSafe(file)
          if (!exists && args.operation !== "workspaceSymbol") throw new Error(`File not found: ${file}`)

          const relPath = path.relative(instance.worktree, file)
          const detail =
            args.operation === "workspaceSymbol"
              ? ""
              : cursorOps.has(args.operation) && args.line !== undefined && args.character !== undefined
                ? `${relPath}:${args.line}:${args.character}`
                : relPath
          const title = detail ? `${args.operation} ${detail}` : args.operation

          // Dispatch to the appropriate LSP operation
          switch (args.operation) {
            case "status": {
              const lspStatus = yield* lsp.status()
              const output = lspStatus.length === 0
                ? "No LSP servers are currently active."
                : lspStatus.map((s) => `  ${s.id} (${s.name}) — ${s.root} — ${s.status}`).join("\n")
              return {
                title: "lsp status",
                metadata: { status: lspStatus },
                output,
              }
            }

            case "diagnostics": {
              const severity = args.severity ?? "all"

              // Check if the path is a directory
              const isDir = yield* fs.isDir(file)
              if (isDir) {
                // Directory diagnostics: collect diagnostics per source file
                const entries = yield* fs.readDirectoryEntries(file).pipe(
                  Effect.catch(() => Effect.succeed([] as FSUtil.DirEntry[])),
                )
                const sourceFiles = entries
                  .filter((entry) => entry.type === "file")
                  .filter((entry) => {
                    const ext = path.extname(entry.name).toLowerCase()
                    return [".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".cpp", ".c", ".h", ".css", ".json", ".yaml", ".rb", ".php", ".swift", ".kt", ".svelte", ".vue"].includes(ext)
                  })
                  .map((entry) => path.join(file, entry.name))

                const blocks: string[] = [`Diagnostics for directory: ${path.relative(instance.worktree, file)}`]
                if (sourceFiles.length === 0) {
                  blocks.push("  No supported source files found.")
                } else {
                  yield* lsp.touchFile(file, "document")
                  const allDiagnostics = yield* lsp.diagnostics()
                  for (const srcFile of sourceFiles) {
                    const normalized = FSUtil.normalizePath(srcFile)
                    const fileDiags = allDiagnostics[normalized] ?? []
                    if (fileDiags.length === 0) continue
                    const formatted = LSP.Diagnostic.formatAll(srcFile, fileDiags, severity)
                    blocks.push(`\n${formatted}`)
                  }
                }
                return {
                  title: `diagnostics ${path.relative(instance.worktree, file)}`,
                  metadata: {},
                  output: blocks.join("\n"),
                }
              }

              // Single file diagnostics
              yield* lsp.touchFile(file, "document")
              const allDiagnostics = yield* lsp.diagnostics()
              const normalizedFile = FSUtil.normalizePath(file)
              const fileDiagnostics = allDiagnostics[normalizedFile] ?? []
              const output = LSP.Diagnostic.formatAll(file, fileDiagnostics, severity)
              return {
                title,
                metadata: { diagnostics: fileDiagnostics },
                output,
              }
            }

            case "goToDefinition":
            case "findReferences":
            case "hover":
            case "goToImplementation":
            case "prepareCallHierarchy":
            case "incomingCalls":
            case "outgoingCalls":
            case "prepareRename": {
              if (args.line === undefined || args.character === undefined) {
                throw new Error(`line and character are required for ${args.operation}`)
              }
              const available = yield* lsp.hasClients(file)
              if (!available) throw new Error("No LSP server available for this file type.")

              yield* lsp.touchFile(file, "document")

              const position = { file, line: args.line - 1, character: args.character - 1 }
              const result: unknown[] = yield* (() => {
                switch (args.operation) {
                  case "goToDefinition":
                    return lsp.definition(position)
                  case "findReferences":
                    return lsp.references(position)
                  case "hover":
                    return lsp.hover(position)
                  case "goToImplementation":
                    return lsp.implementation(position)
                  case "prepareCallHierarchy":
                    return lsp.prepareCallHierarchy(position)
                  case "incomingCalls":
                    return lsp.incomingCalls(position)
                  case "outgoingCalls":
                    return lsp.outgoingCalls(position)
                  case "prepareRename":
                    return lsp.prepareRename(position)
                }
              })()
              return {
                title,
                metadata: { result },
                output: result.length === 0 ? `No results found for ${args.operation}` : JSON.stringify(result, null, 2),
              }
            }

            case "documentSymbol": {
              const available = yield* lsp.hasClients(file)
              if (!available) throw new Error("No LSP server available for this file type.")
              yield* lsp.touchFile(file, "document")
              const result = yield* lsp.documentSymbol(uri)
              return {
                title,
                metadata: { result },
                output: result.length === 0 ? "No symbols found." : JSON.stringify(result, null, 2),
              }
            }

            case "workspaceSymbol": {
              yield* lsp.touchFile(file, "document")
              const result = yield* lsp.workspaceSymbol(args.query ?? "")
              return {
                title,
                metadata: { result },
                output: result.length === 0 ? "No symbols found." : JSON.stringify(result, null, 2),
              }
            }

            case "rename": {
              if (args.line === undefined || args.character === undefined) {
                throw new Error("line and character are required for rename")
              }
              if (!args.newName) {
                throw new Error("newName is required for rename")
              }
              const available = yield* lsp.hasClients(file)
              if (!available) throw new Error("No LSP server available for this file type.")

              yield* lsp.touchFile(file, "document")
              const position = { file, line: args.line - 1, character: args.character - 1 }

              // Validate rename is possible
              const prepareResult = yield* lsp.prepareRename(position)
              const canRename = prepareResult.some((r: any) => r !== null && r !== undefined)
              if (!canRename) {
                return {
                  title,
                  metadata: {},
                  output: "Cannot rename symbol at this position. The symbol may not support renaming.",
                }
              }

              // Perform rename
              const result = yield* lsp.rename({ ...position, newName: args.newName })

              // Apply workspace edits to files
              for (const fileEdit of result.edits) {
                const content = yield* fs.readFileStringSafe(fileEdit.filePath)
                if (content === undefined) continue

                // Sort edits in reverse position order to avoid offset shifts
                const sorted = [...fileEdit.edits].sort((a, b) => {
                  const lineDiff = b.range.start.line - a.range.start.line
                  if (lineDiff !== 0) return lineDiff
                  return b.range.start.character - a.range.start.character
                })

                let modified = content
                for (const edit of sorted) {
                  const lines = modified.split("\n")
                  const startLine = edit.range.start.line
                  const endLine = edit.range.end.line

                  // Calculate start/end positions in the string
                  let startOffset = 0
                  for (let i = 0; i < startLine; i++) {
                    startOffset += lines[i].length + 1
                  }
                  startOffset += edit.range.start.character

                  let endOffset = startOffset - edit.range.start.character
                  for (let i = startLine; i < endLine; i++) {
                    endOffset += lines[i].length + 1
                  }
                  endOffset += edit.range.end.character

                  modified = modified.slice(0, startOffset) + edit.newText + modified.slice(endOffset)
                }

                yield* fs.writeFileString(fileEdit.filePath, modified).pipe(Effect.orDie)
              }

              return {
                title,
                metadata: { edits: result.edits },
                output: result.edits.length === 0
                  ? "No files were affected by the rename."
                  : `Renamed successfully. Affected files:\n${result.message}`,
              }
            }
          }
        }).pipe(Effect.orDie) as any),
    }
  }),
)
