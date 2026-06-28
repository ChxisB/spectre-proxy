/**
 * Context system — loads project-specific patterns from `.talon/context/`
 * directories and injects them into the system prompt.
 *
 * Integrates with TalonAgentsControl's context file format.
 */

import { Effect, Layer, Context } from "effect"
import { FSUtil } from "@talon-ai/core/fs-util"
import { Global } from "@talon-ai/core/global"
import * as path from "path"
import { loadContextFiles, formatContextBlock, type ContextFile } from "@talon-ai/core/config/context"
import { InstanceState } from "@/effect/instance-state"

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface Interface {
  /** Load all context files from the workspace's .talon/context/ */
  readonly load: () => Effect.Effect<ContextFile[]>
  /** Get formatted context block for system prompt injection */
  readonly getSystemBlock: () => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@talon/Context") {}

// ---------------------------------------------------------------------------
// Utilities needed for sync fs bridge
// ---------------------------------------------------------------------------

function createSyncFs(fsutil: FSUtil.Interface) {
  return {
    readdirSync(dir: string): string[] {
      // Fallback: use Node.js fs directly in Bun context
      try {
        const fs = require("fs") as typeof import("fs")
        return fs.readdirSync(dir)
      } catch { return [] }
    },
    readFileSync(p: string, enc: string): string {
      try {
        const fs = require("fs") as typeof import("fs")
        return fs.readFileSync(p, enc as BufferEncoding) as string
      } catch { return "" }
    },
    statSync(p: string): { isDirectory(): boolean } {
      try {
        const fs = require("fs") as typeof import("fs")
        const stat = fs.statSync(p)
        return { isDirectory: () => stat.isDirectory() }
      } catch { return { isDirectory: () => false } }
    },
  }
}

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fsutil = yield* FSUtil.Service

    const load = Effect.fn("Context.load")(function* () {
      const ctx = yield* InstanceState.context
      const syncFs = createSyncFs(fsutil)
      const allContexts: ContextFile[] = []

      // Scan .talon/context/
      const talonContextDir = path.join(ctx.directory, ".talon", "context")
      allContexts.push(...loadContextFiles(talonContextDir, syncFs))

      // Scan global talon context
      const globalContextDir = path.join(Global.Path.config, "context")
      allContexts.push(...loadContextFiles(globalContextDir, syncFs))

      return allContexts
    })

    const getSystemBlock = Effect.fn("Context.getSystemBlock")(function* () {
      const contexts = yield* load()
      return formatContextBlock(contexts)
    })

    return Service.of({ load, getSystemBlock })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(FSUtil.defaultLayer),
)

export * as Context from "./index"
