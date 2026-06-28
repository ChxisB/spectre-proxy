/**
 * Skill-Embedded MCP Manager
 *
 * Manages the lifecycle of MCP servers declared in skill SKILL.md frontmatter.
 * Skills can declare MCP servers that are spawned when the skill is loaded
 * by the agent, and cleaned up when the session ends.
 *
 * Skill frontmatter format:
 * ```yaml
 * ---
 * name: my-skill
 * description: Does something useful
 * mcp_servers:
 *   - name: my-server
 *     type: stdio
 *     command: npx
 *     args: ["-y", "@my/mcp-server"]
 *   - name: web-api
 *     type: remote
 *     url: https://api.example.com/mcp
 * ---
 * ```
 */

export * as SkillMcpPlugin from "./skill-mcp"

import { Effect, Option, Schema, Context, Layer } from "effect"
import { PluginV2 } from "../plugin"
import { SkillV2 } from "../skill"
import * as ConfigMarkdown from "../config/markdown"

// ── Types ──────────────────────────────────────────────────────────────

/** An MCP server configuration embedded in a skill */
export const McpServerDeclaration = Schema.Struct({
    name: Schema.String,
    /** Server type: stdio or remote HTTP/SSE */
    type: Schema.Literals(["stdio", "remote"]),
    /** For stdio: the command to run */
    command: Schema.optional(Schema.String),
    /** For stdio: command arguments */
    args: Schema.optional(Schema.Array(Schema.String)),
    /** For stdio: environment variables */
    env: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    /** For remote: the URL to connect to */
    url: Schema.optional(Schema.String),
    /** Whether the server is enabled */
    enabled: Schema.optional(Schema.Boolean),
})
export type McpServerDeclaration = Schema.Schema.Type<typeof McpServerDeclaration>

/** Skill frontmatter that may include MCP server declarations */
export const SkillFrontmatterWithMcp = Schema.Struct({
    name: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
    slash: Schema.optional(Schema.Boolean),
    model: Schema.optional(Schema.String),
    agent: Schema.optional(Schema.String),
    subtask: Schema.optional(Schema.Boolean),
    "argument-hint": Schema.optional(Schema.String),
    license: Schema.optional(Schema.String),
    compatibility: Schema.optional(Schema.String),
    metadata: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    "allowed-tools": Schema.optional(Schema.Array(Schema.String)),
    mcp_servers: Schema.optional(Schema.Array(McpServerDeclaration)),
    mcp: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
})
export type SkillFrontmatterWithMcp = Schema.Schema.Type<typeof SkillFrontmatterWithMcp>

// ── Frontmatter Parser ─────────────────────────────────────────────────

/**
 * Parse skill content and extract MCP server declarations from frontmatter.
 * Returns the server declarations if present, or an empty array.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function extractMcpServers(
    content: string,
): McpServerDeclaration[] {
    const parsed = ConfigMarkdown.parseOption(content)
    if (!parsed) return []

    const frontmatter = Schema.decodeUnknownOption(SkillFrontmatterWithMcp)(parsed.data)
    if (Option.isNone(frontmatter)) return []
    const servers: McpServerDeclaration[] = []

    // Handle existing array format: mcp_servers
    const mcpServers = frontmatter.value.mcp_servers
    if (mcpServers) {
        servers.push(...mcpServers)
    }

    // Handle OMO record format: mcp (serverName -> {type, command, env, enabled})
    const mcp = frontmatter.value.mcp
    if (mcp && isRecord(mcp)) {
        for (const [name, config] of Object.entries(mcp)) {
            if (!isRecord(config)) continue
            servers.push({
                name,
                type: (config.type as "stdio" | "remote") ?? "stdio",
                command: Array.isArray(config.command) ? (config.command as string[])[0] : (config.command as string | undefined),
                args: Array.isArray(config.command) ? (config.command as string[]).slice(1) : (config.args as string[] | undefined),
                env: isRecord(config.env) ? (config.env as Record<string, string>) : undefined,
                enabled: config.enabled !== false,
            })
        }
    }

    return servers
}

/**
 * Check if a skill has embedded MCP servers.
 */
export function skillHasMcpServers(content: string): boolean {
  return extractMcpServers(content).length > 0
}

// ── Skill MCP Registry ─────────────────────────────────────────────────

export type McpRegistration = {
  skillName: string
  servers: McpServerDeclaration[]
  sessionId?: string
}

const registrations = new Map<string, McpRegistration>()

/**
 * Register MCP servers for a skill.
 * Called when a skill is activated (loaded by the agent).
 */
export function registerSkillMcpServers(
  skillName: string,
  content: string,
  sessionId?: string,
): McpServerDeclaration[] {
  const servers = extractMcpServers(content)
  if (servers.length === 0) return []

  const key = `${sessionId ?? "global"}:${skillName}`
  registrations.set(key, { skillName, servers, sessionId })
  return servers
}

/**
 * Unregister MCP servers for a skill.
 * Called when a skill is deactivated or a session ends.
 */
export function unregisterSkillMcpServers(
  skillName: string,
  sessionId?: string,
): void {
  const key = `${sessionId ?? "global"}:${skillName}`
  registrations.delete(key)
}

/**
 * Unregister all MCP servers for a session.
 * Called when a session ends.
 */
export function unregisterAllForSession(sessionId: string): void {
  for (const [key, reg] of registrations) {
    if (reg.sessionId === sessionId) {
      registrations.delete(key)
    }
  }
}

/**
 * Get all currently registered skill MCP servers.
 */
export function getSkillMcpRegistrations(): McpRegistration[] {
  return Array.from(registrations.values())
}

/**
 * Get MCP servers for a specific session.
 */
export function getSessionMcpRegistrations(sessionId: string): McpRegistration[] {
  return Array.from(registrations.values()).filter(
    (r) => r.sessionId === sessionId,
  )
}

// ── Plugin Registration ────────────────────────────────────────────────

/**
 * PluginV2 that hooks into skill loading to detect and register
 * skill-embedded MCP servers.
 *
 * This plugin:
 * 1. Scans all registered skills for MCP server declarations
 * 2. Provides the SkillMcpRegistry for runtime use
 */
export const Plugin = PluginV2.define({
  id: PluginV2.ID.make("skill-mcp"),
  effect: Effect.gen(function* () {
    const skill = yield* SkillV2.Service

    // On boot, scan all embedded skills for MCP servers
    const allSkills = yield* skill.list()
    for (const skillInfo of allSkills) {
      const servers = extractMcpServers(skillInfo.content)
      if (servers.length > 0) {
        registerSkillMcpServers(skillInfo.name, skillInfo.content)
      }
    }

    return {}
  }),
})
