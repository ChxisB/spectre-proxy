/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { Effect } from "effect"
import { PluginV2 } from "../plugin"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeTalonContent from "./skill/customize-talon.md" with { type: "text" }
import karpathyGuidelinesContent from "./skill/karpathy-guidelines.md" with { type: "text" }
import initDeepContent from "./skill/init-deep.md" with { type: "text" }
import astGrepContent from "./skill/ast-grep.md" with { type: "text" }

export const CustomizeTalonContent = customizeTalonContent
export const KarpathyGuidelinesContent = karpathyGuidelinesContent
export const InitDeepContent = initDeepContent
export const AstGrepContent = astGrepContent

export const Plugin = PluginV2.define({
  id: PluginV2.ID.make("skill"),
  effect: Effect.gen(function* () {
    const skill = yield* SkillV2.Service
    const transform = yield* skill.transform()

    yield* transform((editor) => {
      editor.source(
        new SkillV2.EmbeddedSource({
          type: "embedded",
          skill: new SkillV2.Info({
            name: "customize-talon",
            description:
              "Use ONLY when the user is editing or creating talon's own configuration: talon.json, talon.jsonc, files under .talon/, or files under ~/.config/talon/. Also use when creating or fixing talon agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring talon itself.",
            location: AbsolutePath.make("/builtin/customize-talon.md"),
            content: CustomizeTalonContent,
          }),
        }),
      )

      editor.source(
        new SkillV2.EmbeddedSource({
          type: "embedded",
          skill: new SkillV2.Info({
            name: "karpathy-guidelines",
            description:
              "Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria.",
            location: AbsolutePath.make("/builtin/karpathy-guidelines.md"),
            content: KarpathyGuidelinesContent,
          }),
        }),
      )

      editor.source(
        new SkillV2.EmbeddedSource({
          type: "embedded",
          skill: new SkillV2.Info({
            name: "init-deep",
            description:
              "Generate hierarchical AGENTS.md knowledge base files throughout the project. Improves token efficiency and agent performance by self-documenting the codebase.",
            location: AbsolutePath.make("/builtin/init-deep.md"),
            content: InitDeepContent,
          }),
        }),
      )

      editor.source(
        new SkillV2.EmbeddedSource({
          type: "embedded",
          skill: new SkillV2.Info({
            name: "ast-grep",
            description:
              "Pattern-aware code search and rewriting using ast-grep (sg). AST-level matching across 25+ languages for finding and refactoring code structures.",
            location: AbsolutePath.make("/builtin/ast-grep.md"),
            content: AstGrepContent,
          }),
        }),
      )
    })
  }),
})
