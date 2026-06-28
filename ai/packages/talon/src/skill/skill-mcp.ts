/**
 * App-level Skill-Embedded MCP Manager.
 *
 * Hooks into the skill loading flow. When a skill with MCP server declarations
 * is loaded, registers those MCP servers dynamically with the MCP service.
 */

import { Effect } from "effect"
import { SkillMcpPlugin } from "@talon-ai/core/plugin/skill-mcp"
import { MCP } from "../mcp"
import { Skill } from "../skill"
import type { ConfigMCPV1 } from "@talon-ai/core/v1/config/mcp"

/**
 * Register MCP servers for a skill when it's loaded by the agent.
 */
export function registerMcpForSkill(
  skillName: string,
  sessionId?: string,
) {
  return Effect.gen(function* () {
    const skill = yield* Skill.Service
    const mcp = yield* MCP.Service

    const info = yield* skill.get(skillName).pipe(Effect.catch(() => Effect.succeed(undefined)))
    if (!info) return

    const servers = SkillMcpPlugin.extractMcpServers(info.content)
    if (servers.length === 0) return

    for (const decl of servers) {
      const mcpName = `skill:${skillName}:${decl.name}`

      if (decl.type === "stdio" && decl.command) {
        const command = [decl.command, ...(decl.args ?? [])]
        const config: ConfigMCPV1.Info = {
          type: "local",
          command,
          ...(decl.env ? { environment: decl.env as Record<string, string> } : {}),
        }
        yield* mcp.add(mcpName, config).pipe(Effect.catch(() => Effect.void))
        yield* mcp.connect(mcpName).pipe(Effect.catch(() => Effect.void))
      } else if (decl.type === "remote" && decl.url) {
        const config: ConfigMCPV1.Info = {
          type: "remote",
          url: decl.url,
        }
        yield* mcp.add(mcpName, config).pipe(Effect.catch(() => Effect.void))
        yield* mcp.connect(mcpName).pipe(Effect.catch(() => Effect.void))
      }
    }

    SkillMcpPlugin.registerSkillMcpServers(skillName, info.content, sessionId)
  })
}

/**
 * Unregister all MCP servers owned by a skill.
 */
export function unregisterMcpForSkill(
  skillName: string,
) {
  return Effect.gen(function* () {
    const mcp = yield* MCP.Service
    const registrations = SkillMcpPlugin.getSkillMcpRegistrations()
    const skillReg = registrations.find((r) => r.skillName === skillName)
    if (!skillReg) return

    for (const decl of skillReg.servers) {
      yield* mcp.disconnect(`skill:${skillName}:${decl.name}`).pipe(Effect.catch(() => Effect.void))
    }

    SkillMcpPlugin.unregisterSkillMcpServers(skillName)
  })
}

/**
 * Unregister all skill-owned MCP servers for a session.
 */
export function unregisterMcpForSession(
  sessionId: string,
) {
  return Effect.gen(function* () {
    const mcp = yield* MCP.Service
    const registrations = SkillMcpPlugin.getSessionMcpRegistrations(sessionId)

    for (const reg of registrations) {
      for (const decl of reg.servers) {
        yield* mcp.disconnect(`skill:${reg.skillName}:${decl.name}`).pipe(Effect.catch(() => Effect.void))
      }
    }

    SkillMcpPlugin.unregisterAllForSession(sessionId)
  })
}
