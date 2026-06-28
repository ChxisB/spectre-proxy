import { Schema } from "effect"

export const BUILTIN_CATEGORY_NAMES = [
  "visual-engineering",
  "ultrabrain",
  "deep",
  "artistry",
  "quick",
  "unspecified-low",
  "unspecified-high",
  "writing",
] as const

export type CategoryName = (typeof BUILTIN_CATEGORY_NAMES)[number]

export const CategoryNameSchema = Schema.Literals([
  "visual-engineering",
  "ultrabrain",
  "deep",
  "artistry",
  "quick",
  "unspecified-low",
  "unspecified-high",
  "writing",
] as const)

export class CategoryConfig extends Schema.Class<CategoryConfig>("CategoryConfig")({
  description: Schema.String,
  defaultModel: Schema.String,
}) {}

export const BUILTIN_CATEGORIES: Record<CategoryName, CategoryConfig> = {
  "visual-engineering": new CategoryConfig({
    description: "Frontend/UI work",
    defaultModel: "gemini-3.1-pro",
  }),
  ultrabrain: new CategoryConfig({
    description: "Complex reasoning/architecture",
    defaultModel: "gpt-5.5",
  }),
  deep: new CategoryConfig({
    description: "Deep analysis and autonomous research",
    defaultModel: "gpt-5.5",
  }),
  artistry: new CategoryConfig({
    description: "Creative and design work",
    defaultModel: "gemini-3.1-pro",
  }),
  quick: new CategoryConfig({
    description: "Fast, simple tasks",
    defaultModel: "gpt-5.4-mini",
  }),
  "unspecified-low": new CategoryConfig({
    description: "Generic low-effort fallback",
    defaultModel: "claude-sonnet-4-6",
  }),
  "unspecified-high": new CategoryConfig({
    description: "Generic high-effort fallback",
    defaultModel: "claude-opus-4-7",
  }),
  writing: new CategoryConfig({
    description: "Writing and documentation",
    defaultModel: "gemini-3-flash",
  }),
}

export type ModelType = "coding" | "vision"

const VISION_CATEGORIES: ReadonlySet<string> = new Set(["visual-engineering", "artistry"])

export function categoryToModelType(category: string): ModelType {
  return VISION_CATEGORIES.has(category) ? "vision" : "coding"
}

export function resolveCodingModel(config: { model?: string }): { providerID: string; modelID: string } | undefined {
  if (!config.model) return undefined
  const parts = config.model.split("/")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return undefined
  return { providerID: parts[0], modelID: parts[1] }
}

export function resolveVisionModel(config: { vision_model?: string }): { providerID: string; modelID: string } | undefined {
  if (!config.vision_model) return undefined
  const parts = config.vision_model.split("/")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return undefined
  return { providerID: parts[0], modelID: parts[1] }
}
