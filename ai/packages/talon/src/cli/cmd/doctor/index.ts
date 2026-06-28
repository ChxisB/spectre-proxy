import { Global } from "@talon-ai/core/global"
import { InstallationVersion } from "@talon-ai/core/installation/version"
import { Flag } from "@talon-ai/core/flag/flag"
import os from "os"
import { Effect } from "effect"
import { effectCmd } from "../../effect-cmd"
import { UI } from "../../ui"

// ---------------------------------------------------------------------------
// Doctor Command — comprehensive system diagnostics
// ---------------------------------------------------------------------------
// Usage: talon doctor
// Runs a suite of checks via the Effect runtime: environment, config,
// providers, MCP servers, tools, agents, git, plugins, and global paths.
// ---------------------------------------------------------------------------

export const DoctorCommand = effectCmd({
  command: "doctor",
  describe: "run comprehensive system diagnostics",
  instance: true,
  handler: Effect.fn("Cli.doctor")(function* () {
    // -- 1. Environment --
    section("Environment")
    checkEnvironment()

    // -- 2. Global paths --
    section("Global Paths")
    checkPaths()

    // -- 3. Configuration --
    const { Config } = yield* Effect.promise(() => import("@/config/config"))
    const config = yield* Config.Service.use((c) => c.get()).pipe(Effect.option)
    section("Configuration")
    if (config._tag === "Some") {
      pass("config loaded successfully")
      const origins = (config.value as Record<string, unknown>).plugin_origins
      dim(`plugins configured: ${Array.isArray(origins) ? origins.length : 0}`)
    } else {
      fail("config not loaded")
    }

    // -- 4. Providers --
    const { Provider } = yield* Effect.promise(() => import("@/provider/provider"))
    const providers = yield* Provider.Service.use((p) => p.list()).pipe(Effect.option)
    section("Providers")
    const providerNames = providers._tag === "Some" ? Object.keys(providers.value) : []
    if (providerNames.length === 0) {
      warn("no providers configured")
      info("run 'talon providers' to configure one")
    } else {
      for (const p of providerNames) pass(p)
    }

    // -- 5. MCP Servers --
    const { MCP } = yield* Effect.promise(() => import("@/mcp"))
    const mcpServers = yield* (yield* MCP.Service).status().pipe(Effect.option)
    section("MCP Servers")
    if (mcpServers._tag === "Some") {
      const entries = Object.entries(mcpServers.value)
      if (entries.length === 0) {
        dim("none configured")
      } else {
        for (const [name, st] of entries) {
          switch (st.status) {
            case "connected":
              pass(`${name} — connected`)
              break
            case "disabled":
              dim(`${name} — disabled`)
              break
            case "needs_auth":
              warn(`${name} — needs authentication`)
              break
            default:
              fail(`${name} — ${st.status}${"error" in st && st.error ? `: ${st.error}` : ""}`)
          }
        }
      }
    } else {
      fail("MCP service unavailable")
    }

    // -- 6. Tools --
    const { ToolRegistry } = yield* Effect.promise(() => import("@/tool/registry"))
    const toolIds = yield* (yield* ToolRegistry.Service).ids().pipe(Effect.option)
    section("Tools")
    if (toolIds._tag === "Some" && toolIds.value.length > 0) {
      pass(`${toolIds.value.length} tools registered`)
      dim(toolIds.value.join(", "))
    } else {
      fail("no tools registered")
    }

    // -- 7. Agents --
    const { Agent } = yield* Effect.promise(() => import("@/agent/agent"))
    const agents = yield* (yield* Agent.Service).list().pipe(Effect.option)
    section("Agents")
    if (agents._tag === "Some") {
      for (const a of agents.value) {
        const modeTag = a.mode === "primary"
          ? UI.Style.TEXT_INFO + "primary" + UI.Style.TEXT_NORMAL
          : UI.Style.TEXT_DIM + a.mode + UI.Style.TEXT_NORMAL
        console.log(`  ${PASS} ${a.name.padEnd(16)} ${modeTag}`)
      }
    } else {
      warn("no agents defined")
    }

    // -- 8. Git --
    const { Vcs } = yield* Effect.promise(() => import("@/project/vcs"))
    const branch = yield* (yield* Vcs.Service).branch()
    section("Git")
    if (branch) {
      pass(`git repository on branch ${branch}`)
    } else {
      warn("no git repository (some features limited)")
    }

    // -- 9. Plugins --
    const { Plugin } = yield* Effect.promise(() => import("@/plugin"))
    const hooks = yield* (yield* Plugin.Service).list()
    section("Plugins")
    if (Flag.TALON_PURE) {
      dim("external plugins disabled (--pure)")
    } else if (hooks.length === 0) {
      dim("no plugins loaded")
    } else {
      pass(`${hooks.length} plugin(s) loaded`)
    }

    // -- Validation --
    const { validate } = yield* Effect.promise(() => import("@/tool/validate"))
    const vResults = validate({ scope: "context", agent: "build" })
    section("Validation")
    if (vResults.passed) {
      pass("context validation passed")
    }
    for (const issue of vResults.issues) {
      switch (issue.type) {
        case "error":
          fail(`[${issue.category}] ${issue.message}`)
          break
        case "warning":
          warn(`[${issue.category}] ${issue.message}${issue.details ? ` — ${issue.details}` : ""}`)
          break
        default:
          dim(`[${issue.category}] ${issue.message}`)
      }
    }

    // -- Summary --
    section("Summary")
    pass("all checks complete")
  }),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PASS = `${UI.Style.TEXT_SUCCESS}✓${UI.Style.TEXT_NORMAL}`
const FAIL = `${UI.Style.TEXT_DANGER}✗${UI.Style.TEXT_NORMAL}`
const WARN = `${UI.Style.TEXT_WARNING}⚠${UI.Style.TEXT_NORMAL}`
const INFO = `${UI.Style.TEXT_INFO}→${UI.Style.TEXT_NORMAL}`
const DIML = `${UI.Style.TEXT_DIM}·${UI.Style.TEXT_NORMAL}`

function pass(msg: string) { console.log(`  ${PASS} ${msg}`) }
function fail(msg: string) { console.log(`  ${FAIL} ${msg}`) }
function warn(msg: string) { console.log(`  ${WARN} ${msg}`) }
function info(msg: string) { console.log(`  ${INFO} ${msg}`) }
function dim(msg: string) { console.log(`  ${DIML} ${UI.Style.TEXT_DIM}${msg}${UI.Style.TEXT_NORMAL}`) }

function section(title: string) {
  console.log("")
  console.log(` ${UI.Style.TEXT_HIGHLIGHT_BOLD}${title}${UI.Style.TEXT_NORMAL}`)
  console.log(` ${UI.Style.TEXT_DIM}${"─".repeat(Math.max(40, title.length + 2))}${UI.Style.TEXT_NORMAL}`)
}

function checkEnvironment() {
  const termProg = process.env.TERM_PROGRAM
    ? `${process.env.TERM_PROGRAM}${process.env.TERM_PROGRAM_VERSION ? ` ${process.env.TERM_PROGRAM_VERSION}` : ""}`
    : undefined
  const terminal = [termProg, process.env.TERM].filter(Boolean).join(" / ")
  pass(`talon ${InstallationVersion}`)
  pass(`${os.type()} ${os.release()} ${os.arch()}`)
  if (terminal) pass(`terminal: ${terminal}`)
  else warn("terminal: unknown")
  pass(`node ${process.version}`)
  pass(`pid ${process.pid}`)
}

function checkPaths() {
  for (const [key, value] of Object.entries(Global.Path)) {
    try {
      const { existsSync } = require("fs") as typeof import("fs")
      if (existsSync(value as string)) pass(`${key.padEnd(12)} ${value}`)
      else warn(`${key.padEnd(12)} ${value} (does not exist yet)`)
    } catch { warn(`${key.padEnd(12)} ${value}`) }
  }
}
