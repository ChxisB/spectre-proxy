import { expect, describe, it } from "bun:test"
import {
  isGptModel,
  isClaudeModel,
  isGeminiModel,
  isKimiModel,
  isGlmModel,
  resolvePromptVariant,
} from "../variant-resolver"

describe("isGptModel", () => {
  it("detects gpt-5.5", () => {
    expect(isGptModel("gpt-5.5")).toBe(true)
  })

  it("detects o1", () => {
    expect(isGptModel("o1")).toBe(true)
  })

  it("detects o3", () => {
    expect(isGptModel("o3")).toBe(true)
  })

  it("rejects claude models", () => {
    expect(isGptModel("claude-opus-4-7")).toBe(false)
  })
})

describe("isClaudeModel", () => {
  it("detects claude-opus-4-7", () => {
    expect(isClaudeModel("claude-opus-4-7")).toBe(true)
  })

  it("rejects gpt models", () => {
    expect(isClaudeModel("gpt-5.5")).toBe(false)
  })
})

describe("isGeminiModel", () => {
  it("detects gemini-3.1-pro", () => {
    expect(isGeminiModel("gemini-3.1-pro")).toBe(true)
  })

  it("rejects claude models", () => {
    expect(isGeminiModel("claude-opus-4-7")).toBe(false)
  })
})

describe("isKimiModel", () => {
  it("detects kimi-k2.5", () => {
    expect(isKimiModel("kimi-k2.5")).toBe(true)
  })

  it("detects kimi/k2.5", () => {
    expect(isKimiModel("kimi/k2.5")).toBe(true)
  })

  it("rejects gpt models", () => {
    expect(isKimiModel("gpt-5.5")).toBe(false)
  })
})

describe("isGlmModel", () => {
  it("detects glm-5", () => {
    expect(isGlmModel("glm-5")).toBe(true)
  })

  it("rejects claude models", () => {
    expect(isGlmModel("claude-opus-4-7")).toBe(false)
  })
})

describe("resolvePromptVariant", () => {
  it("resolves gpt-5.5 to gpt for ghost domain", () => {
    const result = resolvePromptVariant("gpt-5.5", "ghost")
    expect(result.name).toBe("gpt")
  })

  it("resolves claude-opus-4-7 to claude for ghost domain", () => {
    const result = resolvePromptVariant("claude-opus-4-7", "ghost")
    expect(result.name).toBe("claude")
  })

  it("resolves unknown model to claude (fallback)", () => {
    const result = resolvePromptVariant("unknown-model", "ghost")
    expect(result.name).toBe("claude")
  })

  it("resolves gemini-3.1-pro to gemini for ultrawork domain", () => {
    const result = resolvePromptVariant("gemini-3.1-pro", "ultrawork")
    expect(result.name).toBe("gemini")
  })

  it("resolves kimi-k2.5 to kimi for ultrawork domain", () => {
    const result = resolvePromptVariant("kimi-k2.5", "ultrawork")
    expect(result.name).toBe("kimi")
  })

  it("resolves anthropic/claude-opus-4-7 to claude for ghost domain", () => {
    const result = resolvePromptVariant("anthropic/claude-opus-4-7", "ghost")
    expect(result.name).toBe("claude")
  })

  it("resolves openai/gpt-5.5 to gpt for ghost domain", () => {
    const result = resolvePromptVariant("openai/gpt-5.5", "ghost")
    expect(result.name).toBe("gpt")
  })

  it("resolves google/gemini-3.1-pro to gemini for ghost domain", () => {
    const result = resolvePromptVariant("google/gemini-3.1-pro", "ghost")
    expect(result.name).toBe("gemini")
  })
})
