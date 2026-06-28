import { LayerNode } from "@talon-ai/core/effect/layer-node"
import { Context, Effect, Layer, Option } from "effect"
import { WisdomService } from "@talon-ai/core/wisdom/service"
import { injectWisdom } from "../wisdom/injector"

import { InstanceState } from "@/effect/instance-state"

import { resolvePromptVariant } from "@talon-ai/core/prompts/variant-resolver"

import PROMPT_DEFAULT from "./prompt/default.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_GPT from "./prompt/gpt.txt"
import PROMPT_KIMI from "./prompt/kimi.txt"

import PROMPT_CODEX from "./prompt/codex.txt"
import PROMPT_TRINITY from "./prompt/trinity.txt"
import PROMPT_ULTRAWORK from "./prompt/ultrawork.txt"
import PROMPT_ULTRAWORK_GPT from "./prompt/ultrawork-gpt.txt"
import PROMPT_ULTRAWORK_GEMINI from "./prompt/ultrawork-gemini.txt"
import PROMPT_ULTRAWORK_KIMI from "./prompt/ultrawork-kimi.txt"
import PROMPT_ULTRAWORK_GLM from "./prompt/ultrawork-glm.txt"
import PROMPT_ULTRAWORK_PLANNER from "./prompt/ultrawork-planner.txt"

import PROMPT_EVIDENCE_MODE from "./prompt/evidence-mode.txt"
import PROMPT_GHOST from "@/agent/prompt/ghost.txt"
import PROMPT_GHOST_GPT from "@/agent/prompt/ghost-gpt.txt"
import PROMPT_GHOST_GEMINI from "@/agent/prompt/ghost-gemini.txt"
import PROMPT_GHOST_KIMI from "@/agent/prompt/ghost-kimi.txt"
import PROMPT_GHOST_GLM from "@/agent/prompt/ghost-glm.txt"
import type { Provider } from "@/provider/provider"
import type { Agent } from "@/agent/agent"
import { Permission } from "@/permission"
import { Skill } from "@/skill"
import { AbsolutePath } from "@talon-ai/core/schema"
import { Location } from "@talon-ai/core/location"
import { LocationServiceMap } from "@talon-ai/core/location-layer"
import { PluginBoot } from "@talon-ai/core/plugin/boot"
import { Reference } from "@talon-ai/core/reference"

export function provider(model: Provider.Model): string[] {
  if (model.api.id.includes("gpt-4") || model.api.id.includes("o1") || model.api.id.includes("o3"))
    return [PROMPT_BEAST]
  if (model.api.id.includes("codex")) return [PROMPT_CODEX]
  if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]

  const variant = resolvePromptVariant(model.api.id, "provider")
  const variantMap: Record<string, string> = {
    "gpt": PROMPT_GPT,
    "gemini": PROMPT_GEMINI,
    "kimi": PROMPT_KIMI,
  }
  return [variantMap[variant.name] ?? PROMPT_DEFAULT]
}

/**
 * Resolve the model-specific Ghost prompt variant.
 * Falls back to the default Ghost prompt if no model-specific variant exists.
 */
export function ghostPrompt(model: Provider.Model): string {
  const variant = resolvePromptVariant(model.api.id, "ghost")
  const variantMap: Record<string, string> = {
    "gpt": PROMPT_GHOST_GPT,
    "gemini": PROMPT_GHOST_GEMINI,
    "kimi": PROMPT_GHOST_KIMI,
    "glm": PROMPT_GHOST_GLM,
  }
  return variantMap[variant.name] ?? PROMPT_GHOST
}

export function resolveUltraworkPrompt(modelID: string): string {
  const variant = resolvePromptVariant(modelID, "ultrawork")
  const variantMap: Record<string, string> = {
    "gpt": PROMPT_ULTRAWORK_GPT,
    "gemini": PROMPT_ULTRAWORK_GEMINI,
    "kimi": PROMPT_ULTRAWORK_KIMI,
    "glm": PROMPT_ULTRAWORK_GLM,
    "planner": PROMPT_ULTRAWORK_PLANNER,
  }
  return variantMap[variant.name] ?? PROMPT_ULTRAWORK
}

export function evidenceModeBlock(): string | undefined {
  return PROMPT_EVIDENCE_MODE
}

export interface Interface {
  readonly environment: (model: Provider.Model) => Effect.Effect<string[]>
  readonly skills: (agent: Agent.Info) => Effect.Effect<string | undefined>
}

export class Service extends Context.Service<Service, Interface>()("@talon/SystemPrompt") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const skill = yield* Skill.Service
    const locations = yield* LocationServiceMap

    return Service.of({
      environment: Effect.fn("SystemPrompt.environment")(function* (model: Provider.Model) {
        const ctx = yield* InstanceState.context
        const references = yield* Effect.gen(function* () {
          yield* (yield* PluginBoot.Service).wait()
          return (yield* (yield* Reference.Service).list()).filter((reference) => reference.description !== undefined)
          }).pipe(Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(ctx.directory) }))))

          const maybeWisdom = yield* Effect.serviceOption(WisdomService.Service)
          const wisdomBlock = Option.isSome(maybeWisdom)
            ? injectWisdom(
                yield* maybeWisdom.value.query({ project: ctx.worktree, limit: 5 }),
                ctx.worktree,
              )
            : undefined

          return [
            [
              `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
              `Here is some useful information about the environment you are running in:`,
              `<env>`,
              `  Working directory: ${ctx.directory}`,
              `  Workspace root folder: ${ctx.worktree}`,
              `  Is directory a git repo: ${ctx.project.vcs === "git" ? "yes" : "no"}`,
              `  Platform: ${process.platform}`,
              `  Today's date: ${new Date().toDateString()}`,
              `</env>`,
            ].join("\n"),
            references.length === 0
              ? undefined
              : [
                  "Project references provide additional directories that can be accessed when relevant.",
                  "<available_references>",
                  ...references
                    .toSorted((a, b) => a.name.localeCompare(b.name))
                    .flatMap((reference) => [
                      "  <reference>",
                      `    <name>${reference.name}</name>`,
                      `    <path>${reference.path}</path>`,
                      ...(reference.description === undefined
                        ? []
                        : [`    <description>${reference.description}</description>`]),
                      "  </reference>",
                    ]),
                  "</available_references>",
                ].join("\n"),
            wisdomBlock,
          ].filter((part): part is string => part !== undefined)
      }),

      skills: Effect.fn("SystemPrompt.skills")(function* (agent: Agent.Info) {
        if (Permission.disabled(["skill"], agent.permission).has("skill")) return

        const list = yield* skill.available(agent)

        return [
          "Skills provide specialized instructions and workflows for specific tasks.",
          "Use the skill tool to load a skill when a task matches its description.",
          // the agents seem to ingest the information about skills a bit better if we present a more verbose
          // version of them here and a less verbose version in tool description, rather than vice versa.
          Skill.fmt(list, { verbose: true }),
        ].join("\n")
      }),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Skill.defaultLayer), Layer.provide(LocationServiceMap.layer))

const locationServiceMapNode = LayerNode.make(LocationServiceMap.layer, [])

export const node = LayerNode.make(layer, [Skill.node, locationServiceMapNode])

export * as SystemPrompt from "./system"
