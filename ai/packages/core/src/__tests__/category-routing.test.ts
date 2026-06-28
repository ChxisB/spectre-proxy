import { expect, describe, it } from "bun:test"
import { categoryToModelType, resolveCodingModel, resolveVisionModel } from "../category"

describe("categoryToModelType", () => {
  it("maps visual-engineering to vision", () => {
    expect(categoryToModelType("visual-engineering")).toBe("vision")
  })

  it("maps artistry to vision", () => {
    expect(categoryToModelType("artistry")).toBe("vision")
  })

  it("maps ultrabrain to coding", () => {
    expect(categoryToModelType("ultrabrain")).toBe("coding")
  })

  it("maps deep to coding", () => {
    expect(categoryToModelType("deep")).toBe("coding")
  })

  it("maps quick to coding", () => {
    expect(categoryToModelType("quick")).toBe("coding")
  })

  it("maps unspecified-low to coding", () => {
    expect(categoryToModelType("unspecified-low")).toBe("coding")
  })

  it("maps unspecified-high to coding", () => {
    expect(categoryToModelType("unspecified-high")).toBe("coding")
  })

  it("maps writing to coding", () => {
    expect(categoryToModelType("writing")).toBe("coding")
  })

  it("is case-sensitive (lowercase only)", () => {
    expect(categoryToModelType("Visual-Engineering")).toBe("coding")
  })

  it("returns coding for unknown categories", () => {
    expect(categoryToModelType("unknown-category")).toBe("coding")
  })
})

describe("resolveCodingModel", () => {
  it("parses provider/model format", () => {
    const result = resolveCodingModel({ model: "anthropic/claude-opus-4-7" })
    expect(result).toEqual({ providerID: "anthropic", modelID: "claude-opus-4-7" })
  })

  it("returns undefined when model is not set", () => {
    expect(resolveCodingModel({})).toBeUndefined()
  })

  it("returns undefined when model is undefined", () => {
    expect(resolveCodingModel({ model: undefined })).toBeUndefined()
  })

  it("returns undefined for malformed model string (no slash)", () => {
    expect(resolveCodingModel({ model: "just-a-model" })).toBeUndefined()
  })

  it("returns undefined for malformed model string (empty parts)", () => {
    expect(resolveCodingModel({ model: "/model" })).toBeUndefined()
  })
})

describe("resolveVisionModel", () => {
  it("parses provider/model format", () => {
    const result = resolveVisionModel({ vision_model: "openai/gpt-5.5" })
    expect(result).toEqual({ providerID: "openai", modelID: "gpt-5.5" })
  })

  it("parses anthropic vision model", () => {
    const result = resolveVisionModel({ vision_model: "anthropic/claude-sonnet-4" })
    expect(result).toEqual({ providerID: "anthropic", modelID: "claude-sonnet-4" })
  })

  it("returns undefined when vision_model is not set", () => {
    expect(resolveVisionModel({})).toBeUndefined()
  })

  it("returns undefined when vision_model is undefined", () => {
    expect(resolveVisionModel({ vision_model: undefined })).toBeUndefined()
  })

  it("returns undefined for malformed vision model string", () => {
    expect(resolveVisionModel({ vision_model: "bad-format" })).toBeUndefined()
  })
})
