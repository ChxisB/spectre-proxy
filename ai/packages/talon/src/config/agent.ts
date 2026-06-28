export * as ConfigAgent from "./agent"

import path from "path"
import { Exit, Schema } from "effect"
import { Glob } from "@talon-ai/core/util/glob"
import { ConfigAgentV1 } from "@talon-ai/core/v1/config/agent"
import { configEntryNameFromPath } from "./entry-name"
import * as ConfigMarkdown from "./markdown"
import { ConfigParse } from "./parse"

/** Normalize OAC-style nested permission format to Talon's flat format.
 *  OAC format: { read: { "*": "allow" }, write: { "*": "deny" } }
 *  Talon format: { read: "allow", write: "deny" }
 *
 *  Also handles path-patterned permissions:
 *  OAC: { edit: { "*": "deny", ".talon/plans/*.md": "allow" } }
 *  Talon: { edit: { "*": "deny", ".talon/plans/*.md": "allow" } }
 *  (path-patterned passes through as-is)
 */
function normalizePermissions(data: Record<string, unknown>): Record<string, unknown> {
  const perm = data.permission
  if (!perm || typeof perm !== "object" || Array.isArray(perm)) return data

  const normalized: Record<string, string | Record<string, string>> = {}
  let hasChanges = false

  for (const [key, value] of Object.entries(perm as Record<string, unknown>)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const inner = value as Record<string, unknown>
      // Check if all inner values are simple strings (OAC flat format)
      const allSimple = Object.values(inner).every((v) => typeof v === "string")
      if (allSimple && Object.keys(inner).length === 1 && "*" in inner) {
        // Simple case: { "*": "allow" } → "allow"
        normalized[key] = inner["*"] as string
        hasChanges = true
        continue
      }
      if (allSimple) {
        // Path-patterned case: { "*": "deny", "*.md": "allow" } → preserve as-is
        normalized[key] = inner as Record<string, string>
        hasChanges = true
        continue
      }
    }
    // Keep original flat values
    if (typeof value === "string") {
      normalized[key] = value
    }
  }

  if (hasChanges) {
    return { ...data, permission: normalized }
  }
  return data
}

export async function load(dir: string) {
  const result: Record<string, ConfigAgentV1.Info> = {}
  for (const item of await Glob.scan("{agent,agents}/**/*.md", {
    cwd: dir,
    absolute: true,
    dot: true,
    symlink: true,
  })) {
    const md = await ConfigMarkdown.parse(item).catch(() => undefined)
    if (!md) continue

    const name = configEntryNameFromPath(path.relative(dir, item), ["agent/", "agents/"])

    const config = {
      name,
      ...normalizePermissions(md.data as Record<string, unknown>),
      prompt: md.content.trim(),
    }
    result[config.name] = ConfigParse.schema(ConfigAgentV1.Info, config, item)
  }
  return result
}

export async function loadMode(dir: string) {
  const result: Record<string, ConfigAgentV1.Info> = {}
  for (const item of await Glob.scan("{mode,modes}/*.md", {
    cwd: dir,
    absolute: true,
    dot: true,
    symlink: true,
  })) {
    const md = await ConfigMarkdown.parse(item).catch(() => undefined)
    if (!md) continue

    const config = {
      name: configEntryNameFromPath(path.relative(dir, item), ["mode/", "modes/"]),
      ...md.data,
      prompt: md.content.trim(),
    }
    const parsed = Schema.decodeUnknownExit(ConfigAgentV1.Info)(config, { errors: "all", propertyOrder: "original" })
    if (Exit.isSuccess(parsed)) {
      result[config.name] = {
        ...parsed.value,
        mode: "primary" as const,
      }
    }
  }
  return result
}
