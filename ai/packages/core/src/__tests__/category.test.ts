import { expect, describe, it } from "bun:test"
import { BUILTIN_CATEGORY_NAMES, BUILTIN_CATEGORIES, type CategoryName } from "../category"

describe("BUILTIN_CATEGORY_NAMES", () => {
  it("has exactly 8 built-in categories", () => {
    expect(BUILTIN_CATEGORY_NAMES.length).toBe(8)
  })

  it("includes all expected category names", () => {
    const names: CategoryName[] = [
      "visual-engineering",
      "ultrabrain",
      "deep",
      "artistry",
      "quick",
      "unspecified-low",
      "unspecified-high",
      "writing",
    ]
    for (const name of names) {
      expect(BUILTIN_CATEGORY_NAMES).toContain(name)
    }
  })
})

describe("BUILTIN_CATEGORIES", () => {
  it("has entries for all builtin category names", () => {
    for (const name of BUILTIN_CATEGORY_NAMES) {
      expect(BUILTIN_CATEGORIES[name]).toBeDefined()
    }
  })

  it("has 8 entries", () => {
    expect(Object.keys(BUILTIN_CATEGORIES).length).toBe(8)
  })

  it("each entry has a description and defaultModel", () => {
    for (const name of BUILTIN_CATEGORY_NAMES) {
      const config = BUILTIN_CATEGORIES[name]
      expect(config.description).toBeTruthy()
      expect(typeof config.description).toBe("string")
      expect(config.defaultModel).toBeTruthy()
      expect(typeof config.defaultModel).toBe("string")
    }
  })

  it("visual-engineering has correct config", () => {
    const cat = BUILTIN_CATEGORIES["visual-engineering"]
    expect(cat.description).toBe("Frontend/UI work")
    expect(cat.defaultModel).toBe("gemini-3.1-pro")
  })

  it("ultrabrain has correct config", () => {
    const cat = BUILTIN_CATEGORIES["ultrabrain"]
    expect(cat.description).toBe("Complex reasoning/architecture")
    expect(cat.defaultModel).toBe("gpt-5.5")
  })

  it("deep has correct config", () => {
    const cat = BUILTIN_CATEGORIES["deep"]
    expect(cat.description).toBe("Deep analysis and autonomous research")
    expect(cat.defaultModel).toBe("gpt-5.5")
  })

  it("artistry has correct config", () => {
    const cat = BUILTIN_CATEGORIES["artistry"]
    expect(cat.description).toBe("Creative and design work")
    expect(cat.defaultModel).toBe("gemini-3.1-pro")
  })

  it("quick has correct config", () => {
    const cat = BUILTIN_CATEGORIES["quick"]
    expect(cat.description).toBe("Fast, simple tasks")
    expect(cat.defaultModel).toBe("gpt-5.4-mini")
  })

  it("unspecified-low has correct config", () => {
    const cat = BUILTIN_CATEGORIES["unspecified-low"]
    expect(cat.description).toBe("Generic low-effort fallback")
    expect(cat.defaultModel).toBe("claude-sonnet-4-6")
  })

  it("unspecified-high has correct config", () => {
    const cat = BUILTIN_CATEGORIES["unspecified-high"]
    expect(cat.description).toBe("Generic high-effort fallback")
    expect(cat.defaultModel).toBe("claude-opus-4-7")
  })

  it("writing has correct config", () => {
    const cat = BUILTIN_CATEGORIES["writing"]
    expect(cat.description).toBe("Writing and documentation")
    expect(cat.defaultModel).toBe("gemini-3-flash")
  })
})
