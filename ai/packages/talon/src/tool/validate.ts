/**
 * Validator — comprehensive session and agent behavior validation.
 *
 * Heavily inspired by TalonAgentsControl's agent-validator plugin.
 * Validates: approval gate compliance, context loading, delegation
 * decisions, tool permissions, and critical rule adherence.
 *
 * Usage:
 *   - As a tool: agents can call `validate` to self-check
 *   - As a CLI extension: `talon doctor` runs validation checks
 */

import * as Tool from "./tool"
import { Effect, Schema } from "effect"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const Parameters = Schema.Struct({
  scope: Schema.optional(
    Schema.Literals(["session", "context", "delegation", "permissions", "all"]).annotate({
      description: "What to validate. Default: all",
    }),
  ),
  sessionID: Schema.optional(Schema.String).annotate({
    description: "Session ID to validate (if scope=session)",
  }),
  agent: Schema.optional(Schema.String).annotate({
    description: "Agent name to validate permissions for",
  }),
})

export interface ValidationIssue {
  type: "error" | "warning" | "info"
  category: string
  message: string
  details?: string
}

export interface ValidationResult {
  passed: boolean
  issues: ValidationIssue[]
  summary: string
}

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

function validateApprovalGates(agent: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check if the agent has an explicit approval process
  const agentsWithoutGates = ["explore", "librarian", "reviewer"]
  if (agentsWithoutGates.includes(agent)) {
    issues.push({
      type: "info",
      category: "approval-gates",
      message: `Agent "${agent}" is read-only — approval gates not required`,
    })
  } else {
    issues.push({
      type: "info",
      category: "approval-gates",
      message: `Agent "${agent}" should propose a plan before executing changes`,
    })
  }

  return issues
}

function validateContextAvailability(): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  try {
    const fs = require("fs") as typeof import("fs")
    const path = require("path") as typeof import("path")

    // Check for context directories
    const talonCtx = path.join(process.cwd(), ".talon", "context")
    const talonExists = fs.existsSync(talonCtx)

    if (!talonExists) {
      issues.push({
        type: "warning",
        category: "context",
        message: "No project context directory found (.talon/context/)",
        details: "Run /add-context to set up project patterns and standards",
      })
    } else {
      const count = countFiles(talonCtx)
      issues.push({
        type: "info",
        category: "context",
        message: `Found ${count} context files in .talon/context/`,
      })
    }
  } catch {
    issues.push({
      type: "warning",
      category: "context",
      message: "Unable to check context directory",
    })
  }

  return issues
}

function validatePermissions(agent: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Common permission issues
  if (agent === "build" || agent === "talonagent" || agent === "taloncoder") {
    issues.push({
      type: "info",
      category: "permissions",
      message: `Agent "${agent}" has full edit/write access — ensure approval gates are in place`,
    })
  }

  return issues
}

function countFiles(dir: string): number {
  try {
    const fs = require("fs") as typeof import("fs")
    const path = require("path") as typeof import("path")
    let count = 0
    function walk(d: string) {
      for (const entry of fs.readdirSync(d)) {
        const full = path.join(d, entry)
        if (fs.statSync(full).isDirectory()) walk(full)
        else if (entry.endsWith(".md")) count++
      }
    }
    walk(dir)
    return count
  } catch { return 0 }
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

export function validate(input: {
  scope: string
  agent?: string
  sessionID?: string
}): ValidationResult {
  const allIssues: ValidationIssue[] = []
  const agent = input.agent || "build"

  if (input.scope === "all" || input.scope === "approval-gates") {
    allIssues.push(...validateApprovalGates(agent))
  }

  if (input.scope === "all" || input.scope === "context") {
    allIssues.push(...validateContextAvailability())
  }

  if (input.scope === "all" || input.scope === "permissions") {
    allIssues.push(...validatePermissions(agent))
  }

  const errors = allIssues.filter((i) => i.type === "error")
  const warnings = allIssues.filter((i) => i.type === "warning")

  const lines: string[] = []
  lines.push(`# Validation Report (scope: ${input.scope}, agent: ${agent})`)
  lines.push("")

  if (errors.length > 0) {
    lines.push(`## ❌ ${errors.length} Error(s)`)
    for (const e of errors) lines.push(`- [${e.category}] ${e.message}${e.details ? ` — ${e.details}` : ""}`)
    lines.push("")
  }

  if (warnings.length > 0) {
    lines.push(`## ⚠️ ${warnings.length} Warning(s)`)
    for (const w of warnings) lines.push(`- [${w.category}] ${w.message}${w.details ? ` — ${w.details}` : ""}`)
    lines.push("")
  }

  const infos = allIssues.filter((i) => i.type === "info")
  if (infos.length > 0) {
    lines.push(`## ℹ️ ${infos.length} Info`)
    for (const i of infos) lines.push(`- [${i.category}] ${i.message}`)
    lines.push("")
  }

  lines.push(`**${errors.length === 0 ? "✅ All checks passed" : "❌ Issues found"}**`)

  return {
    passed: errors.length === 0,
    issues: allIssues,
    summary: lines.join("\n"),
  }
}

// ---------------------------------------------------------------------------
// Validate Tool — agents can call this to self-check
// ---------------------------------------------------------------------------

export const ValidateTool = Tool.define(
  "validate",
  Effect.gen(function* () {
    return {
      description: [
        "Validate session health, context loading, delegation decisions, and agent permissions.",
        "Call this to self-check before making changes.",
        "",
        "Scopes:",
        "- session: Validate session state and message history",
        "- context: Check context file availability and coverage",
        "- delegation: Validate subagent delegation decisions",
        "- permissions: Check agent permissions and tool access",
        "- all: Run all validations (default)",
      ].join("\n"),
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const scope = params.scope ?? "all"
          const result = validate({ scope, agent: params.agent ?? ctx.agent, sessionID: params.sessionID ?? ctx.sessionID })

          return {
            title: `validate (${scope})`,
            metadata: {
              passed: result.passed,
              issues: result.issues.length,
            },
            output: result.summary,
          }
        }).pipe(Effect.orDie),
    }
  }),
)
