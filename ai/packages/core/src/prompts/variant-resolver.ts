const gptPattern = /gpt|o1|o3/i
const claudePattern = /claude/i
const geminiPattern = /gemini/i
const kimiPattern = /kimi/i
const glmPattern = /glm/i
const codexPattern = /codex/i

export function isGptModel(id: string): boolean {
  return gptPattern.test(id)
}

export function isClaudeModel(id: string): boolean {
  return claudePattern.test(id)
}

export function isGeminiModel(id: string): boolean {
  return geminiPattern.test(id)
}

export function isKimiModel(id: string): boolean {
  return kimiPattern.test(id)
}

export function isGlmModel(id: string): boolean {
  return glmPattern.test(id)
}

export function isCodexModel(id: string): boolean {
  return codexPattern.test(id)
}

export type Domain = "ghost" | "ultrawork" | "provider"

export interface PromptVariant {
  name: string
  prompt: string
}

function detectModelFamily(id: string): string {
  if (isGptModel(id)) return "gpt"
  if (isClaudeModel(id)) return "claude"
  if (isGeminiModel(id)) return "gemini"
  if (isKimiModel(id)) return "kimi"
  if (isGlmModel(id)) return "glm"
  return "claude"
}

export function resolvePromptVariant(modelID: string, domain: Domain): PromptVariant {
  const name = detectModelFamily(modelID)
  return { name, prompt: `${domain}-${name}` }
}
