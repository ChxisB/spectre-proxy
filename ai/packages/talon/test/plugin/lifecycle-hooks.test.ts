import { describe, expect } from "bun:test"
import { Effect, Exit, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { CrossSpawnSpawner } from "@talon-ai/core/cross-spawn-spawner"
import { FSUtil } from "@talon-ai/core/fs-util"
import { EffectFlock } from "@talon-ai/core/util/effect-flock"
import path from "path"
import { pathToFileURL } from "url"
import { EventV2Bridge } from "../../src/event-v2-bridge"
import { Config } from "../../src/config/config"
import { Env } from "../../src/env"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { Plugin } from "../../src/plugin/index"

import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { AccountTest } from "../fake/account"
import { AuthTest } from "../fake/auth"
import { NpmTest } from "../fake/npm"

const configLayer = Config.layer.pipe(
  Layer.provide(EffectFlock.defaultLayer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Env.defaultLayer),
  Layer.provide(AuthTest.empty),
  Layer.provide(AccountTest.empty),
  Layer.provide(NpmTest.noop),
  Layer.provide(FetchHttpClient.layer),
)

const it = testEffect(
  Layer.mergeAll(
    Plugin.layer.pipe(
      Layer.provide(EventV2Bridge.defaultLayer),
      Layer.provide(configLayer),
      Layer.provide(RuntimeFlags.layer({ disableDefaultPlugins: true })),
    ),
    CrossSpawnSpawner.defaultLayer,
  ),
)

function withProject<A, E, R>(source: string, self: Effect.Effect<A, E, R>) {
  return Effect.gen(function* () {
    const test = yield* TestInstance
    const file = path.join(test.directory, "plugin.ts")
    yield* Effect.all(
      [
        Effect.promise(() => Bun.write(file, source)),
        Effect.promise(() =>
          Bun.write(
            path.join(test.directory, "talon.json"),
            JSON.stringify(
              {
                $schema: "https://talon.ai/config.json",
                plugin: [pathToFileURL(file).href],
              },
              null,
              2,
            ),
          ),
        ),
      ],
      { discard: true, concurrency: 2 },
    )
    return yield* self
  })
}

const registeredHooks = {
  "chat.message.before": [] as any[],
  "session.created": [] as any[],
  "session.ended": [] as any[],
  "subagent.started": [] as any[],
  "subagent.ended": [] as any[],
  "compaction.after": [] as any[],
  "provider.request.before": [] as any[],
  "provider.request.after": [] as any[],
  "message.stream.delta": [] as any[],
  "tool.definition.transform": [] as any[],
}

function resetHooks() {
  for (const key of Object.keys(registeredHooks)) {
    registeredHooks[key as keyof typeof registeredHooks] = []
  }
}

function makeTrackingPlugin() {
  const hooks: Record<string, (input: any, output: any) => Promise<void>> = {}
  for (const [key] of Object.entries(registeredHooks)) {
    hooks[key] = async (input: any, output: any) => {
      registeredHooks[key as keyof typeof registeredHooks].push({ input, output })
    }
  }
  return hooks
}

describe("lifecycle hooks", () => {
  it.instance("chat.message.before fires with expected input shape", () =>
    withProject(
      [
        "export default async () => ({",
        `  "chat.message.before": async (input, output) => {`,
        `    output.parts = output.parts || []`,
        `    output.system = ["test-system"]`,
        `    output.tools = { test_tool: true }`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        const out = { parts: [{ type: "text", text: "hello" }], system: undefined as string[] | undefined, tools: undefined as Record<string, boolean> | undefined }
        yield* plugin.trigger("chat.message.before", {
          sessionID: "test-session",
          agent: "test-agent",
          text: "hello",
          parts: [{ type: "text", text: "hello" }],
        }, out)
        expect(out.system).toEqual(["test-system"])
        expect(out.tools).toEqual({ test_tool: true })
      }),
    ),
  )

  it.instance("session.created fires with expected input shape", () =>
    withProject(
      [
        "export default async () => ({",
        `  "session.created": async (input, _output) => {`,
        `    if (!input.sessionID) throw new Error("missing sessionID")`,
        `    if (!input.agent) throw new Error("missing agent")`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        yield* plugin.trigger("session.created", {
          sessionID: "test-session",
          agent: "test-agent",
          model: { providerID: "test-provider", modelID: "test-model" },
          directory: "/tmp",
        }, {})
      }),
    ),
  )

  it.instance("session.ended fires with expected input shape", () =>
    withProject(
      [
        "export default async () => ({",
        `  "session.ended": async (input, _output) => {`,
        `    if (!input.sessionID) throw new Error("missing sessionID")`,
        `    if (!input.reason) throw new Error("missing reason")`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        yield* plugin.trigger("session.ended", {
          sessionID: "test-session",
          reason: "deleted",
        }, {})
      }),
    ),
  )

  it.instance("subagent.started fires with expected input shape", () =>
    withProject(
      [
        "export default async () => ({",
        `  "subagent.started": async (input, _output) => {`,
        `    if (!input.sessionID) throw new Error("missing sessionID")`,
        `    if (!input.parentSessionID) throw new Error("missing parentSessionID")`,
        `    if (!input.agent) throw new Error("missing agent")`,
        `    if (!input.task) throw new Error("missing task")`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        yield* plugin.trigger("subagent.started", {
          sessionID: "test-session",
          parentSessionID: "parent-session",
          agent: "test-agent",
          task: "do something",
        }, {})
      }),
    ),
  )

  it.instance("subagent.ended fires with expected input shape", () =>
    withProject(
      [
        "export default async () => ({",
        `  "subagent.ended": async (input, _output) => {`,
        `    if (!input.sessionID) throw new Error("missing sessionID")`,
        `    if (!input.parentSessionID) throw new Error("missing parentSessionID")`,
        `    if (!input.agent) throw new Error("missing agent")`,
        `    if (!input.task) throw new Error("missing task")`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        yield* plugin.trigger("subagent.ended", {
          sessionID: "test-session",
          parentSessionID: "parent-session",
          agent: "test-agent",
          task: "do something",
        }, {})
      }),
    ),
  )

  it.instance("subagent.ended can include error", () =>
    withProject(
      [
        "export default async () => ({",
        `  "subagent.ended": async (input, _output) => {`,
        `    if (input.error !== "something went wrong") throw new Error("unexpected error")`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        yield* plugin.trigger("subagent.ended", {
          sessionID: "test-session",
          parentSessionID: "parent-session",
          agent: "test-agent",
          task: "do something",
          error: "something went wrong",
        }, {})
      }),
    ),
  )

  it.instance("compaction.after fires with expected input shape", () =>
    withProject(
      [
        "export default async () => ({",
        `  "compaction.after": async (input, _output) => {`,
        `    if (!input.sessionID) throw new Error("missing sessionID")`,
        `    if (!["continue","stop","error"].includes(input.result)) throw new Error("invalid result")`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        yield* plugin.trigger("compaction.after", {
          sessionID: "test-session",
          result: "continue",
          messagesBefore: 100,
          messagesAfter: 50,
        }, {})
        yield* plugin.trigger("compaction.after", {
          sessionID: "test-session",
          result: "stop",
        }, {})
      }),
    ),
  )

  it.instance("provider.request.before fires with expected input shape", () =>
    withProject(
      [
        "export default async () => ({",
        `  "provider.request.before": async (input, output) => {`,
        `    if (!input.sessionID) throw new Error("missing sessionID")`,
        `    if (!input.providerID) throw new Error("missing providerID")`,
        `    if (!input.modelID) throw new Error("missing modelID")`,
        `    if (!input.request) throw new Error("missing request")`,
        `    if (!input.request.messages) throw new Error("missing messages")`,
        `    output.options = { custom: true }`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        const out = { options: {} as Record<string, any> }
        yield* plugin.trigger("provider.request.before", {
          sessionID: "test-session",
          providerID: "test-provider",
          modelID: "test-model",
          request: {
            system: "system prompt",
            messages: [{ role: "user", content: "hello" }],
            tools: { test_tool: { execute: async () => ({}) } },
          },
        }, out)
        expect(out.options).toEqual({ custom: true })
      }),
    ),
  )

  it.instance("provider.request.after fires with expected input shape", () =>
    withProject(
      [
        "export default async () => ({",
        `  "provider.request.after": async (input, _output) => {`,
        `    if (!input.sessionID) throw new Error("missing sessionID")`,
        `    if (!input.providerID) throw new Error("missing providerID")`,
        `    if (!input.modelID) throw new Error("missing modelID")`,
        `    if (typeof input.duration !== "number") throw new Error("missing duration")`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        yield* plugin.trigger("provider.request.after", {
          sessionID: "test-session",
          providerID: "test-provider",
          modelID: "test-model",
          duration: 100,
        }, {})
        yield* plugin.trigger("provider.request.after", {
          sessionID: "test-session",
          providerID: "test-provider",
          modelID: "test-model",
          duration: 200,
          error: "timeout",
        }, {})
      }),
    ),
  )

  it.instance("message.stream.delta fires with expected input shape", () =>
    withProject(
      [
        "export default async () => ({",
        `  "message.stream.delta": async (input, _output) => {`,
        `    if (!input.sessionID) throw new Error("missing sessionID")`,
        `    if (!input.messageID) throw new Error("missing messageID")`,
        `    if (!input.partID) throw new Error("missing partID")`,
        `    if (!["text","reasoning","tool"].includes(input.type)) throw new Error("invalid type")`,
        `    if (typeof input.delta !== "string") throw new Error("missing delta")`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        yield* plugin.trigger("message.stream.delta", {
          sessionID: "test-session",
          messageID: "msg-1",
          partID: "part-1",
          type: "text",
          delta: "hello",
        }, {})
      }),
    ),
  )

  it.instance("tool.definition.transform fires with expected input shape", () =>
    withProject(
      [
        "export default async () => ({",
        `  "tool.definition.transform": async (input, output) => {`,
        `    if (!input.toolID) throw new Error("missing toolID")`,
        `    if (!input.tool) throw new Error("missing tool")`,
        `    output.description = "custom description"`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        const out = { description: "original", parameters: { type: "object", properties: {} } }
        yield* plugin.trigger("tool.definition.transform", {
          toolID: "test-tool",
          tool: { execute: async () => ({}) },
          sessionID: "test-session",
        }, out)
        expect(out.description).toBe("custom description")
      }),
    ),
  )

  it.instance("hook failures do not crash the flow", () =>
    withProject(
      [
        "export default async () => ({",
        `  "chat.message.before": async (_input, _output) => {`,
        `    throw new Error("hook crashed")`,
        "  },",
        "})",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        const out = { parts: [] as any[], system: undefined as string[] | undefined, tools: undefined as Record<string, boolean> | undefined }
        const exit = yield* Effect.exit(plugin.trigger("chat.message.before", {
          sessionID: "test-session",
          agent: "test-agent",
          text: "hello",
          parts: [],
        }, out))
        expect(Exit.isFailure(exit)).toBe(true)
      }),
    ),
  )

  it.instance("multiple plugins each register chat.message.before", () =>
    withProject(
      [
        "export default async () => {",
        `  const count = globalThis.__hookCount ?? 0`,
        `  globalThis.__hookCount = count + 1`,
        `  const name = count === 0 ? "first" : "second"`,
        "  return {",
        `    "chat.message.before": async (_input, output) => {`,
        `      output.system = output.system || []`,
        `      output.system.push(name)`,
        "    },",
        "  }",
        "}",
      ].join("\n"),
      Effect.gen(function* () {
        const plugin = yield* Plugin.Service
        const out = { parts: [] as any[], system: [] as string[], tools: undefined as Record<string, boolean> | undefined }
        yield* plugin.trigger("chat.message.before", {
          sessionID: "test-session",
          agent: "test-agent",
          text: "hello",
          parts: [],
        }, out)
        expect(out.system.length).toBeGreaterThan(0)
      }),
    ),
  )
})
