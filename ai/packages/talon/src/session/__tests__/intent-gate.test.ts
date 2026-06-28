import { expect, describe, it } from "bun:test"
import { analyze } from "../intent-gate"

describe("IntentGate - Category Detection", () => {
  it("classifies architect intent as ultrabrain category", () => {
    const result = analyze("design the architecture for the new payment system")
    expect(result.intent).toBe("architect")
    expect(result.category).toBe("ultrabrain")
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it("classifies create intent as deep category", () => {
    const result = analyze("create a new authentication module")
    expect(result.category).toBe("deep")
  })

  it("classifies implement intent as deep category", () => {
    const result = analyze("implement the user profile feature")
    expect(result.category).toBe("deep")
  })

  it("classifies fix/bug intent as deep category", () => {
    const result = analyze("fix the null pointer exception in the parser")
    expect(result.category).toBe("deep")
  })

  it("classifies fix intent as deep category", () => {
    const result = analyze("fix the login flow issue")
    expect(result.category).toBe("deep")
  })

  it("classifies search intent as quick category", () => {
    const result = analyze("find where the database connection is configured")
    expect(result.category).toBe("quick")
  })

  it("classifies review intent as unspecified-low category", () => {
    const result = analyze("review the pull request for security issues")
    expect(result.category).toBe("unspecified-low")
  })

  it("does not assign category for ambiguous general text", () => {
    const result = analyze("hello, how are you?")
    expect(result.category).toBeUndefined()
  })
})

describe("IntentGate - Mode Detection", () => {
  it("detects ultrawork mode", () => {
    const result = analyze("ultrawork implement the core algorithm")
    expect(result.ultrawork).toBe(true)
  })

  it("detects ulw shorthand", () => {
    const result = analyze("ulw build the entire backend")
    expect(result.ultrawork).toBe(true)
  })

  it("detects hyperplan mode", () => {
    const result = analyze("hpp design the migration strategy")
    expect(result.hyperplan).toBe(true)
  })

  it("detects hyperplan spelled out", () => {
    const result = analyze("hyperplan the system architecture")
    expect(result.hyperplan).toBe(true)
  })

  it("detects team mode", () => {
    const result = analyze("team implement this feature")
    expect(result.team).toBe(true)
  })

  it("detects team_mode variant", () => {
    const result = analyze("team_mode coordinate the deployment")
    expect(result.team).toBe(true)
  })
})

describe("IntentGate - Agent Suggestion", () => {
  it("suggests explore agent for search + quick", () => {
    const result = analyze("find the api endpoint definitions")
    expect(result.suggestedAgent).toBe("explore")
  })

  it("suggests architect agent for architect + ultrabrain", () => {
    const result = analyze("design the component architecture")
    expect(result.suggestedAgent).toBe("architect")
  })

  it("suggests build agent for edit + deep", () => {
    const result = analyze("implement the database layer")
    expect(result.suggestedAgent).toBe("build")
  })
})

describe("IntentGate - System Hints", () => {
  it("injects system hint for deep category", () => {
    const result = analyze("create a new authentication system")
    expect(result.systemHint).toBeTruthy()
  })

  it("injects agent hint when agent is suggested", () => {
    const result = analyze("find all references to the User model")
    expect(result.systemHint).toContain("exploration")
  })
})

describe("IntentGate - Confidence", () => {
  it("returns confidence between 0 and 1", () => {
    const result = analyze("implement the payment gateway")
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(0.95)
  })

  it("has higher confidence with category match", () => {
    const withCategory = analyze("design the architecture")
    const without = analyze("hello world")
    expect(withCategory.confidence).toBeGreaterThan(without.confidence)
  })

  it("has highest confidence with ultrawork + category", () => {
    const result = analyze("ultrawork design the complete architecture")
    expect(result.confidence).toBeGreaterThan(0.7)
  })
})

describe("IntentGate - Edge Cases", () => {
  it("handles empty text gracefully", () => {
    const result = analyze("")
    expect(result.intent).toBe("general")
    expect(result.category).toBeUndefined()
    expect(result.ultrawork).toBe(false)
  })

  it("handles single word text", () => {
    const result = analyze("hello")
    expect(result.intent).toBe("general")
  })

  it("handles code blocks without false matches", () => {
    const result = analyze("```\nfunction team() { return true }\n```")
    expect(result.team).toBe(false)
  })

  it("handles mixed case keywords", () => {
    const result = analyze("ULTRAWORK Design The Architecture")
    expect(result.ultrawork).toBe(true)
    expect(result.intent).toBe("architect")
    expect(result.category).toBe("ultrabrain")
  })

  it("records matches in result", () => {
    const result = analyze("ultrawork fix the critical bug")
    expect(result.matches.length).toBeGreaterThan(0)
  })

  it("limits matches to 3 entries", () => {
    const text = Array.from({ length: 10 }, (_, i) => `keyword${i}`).join(" ")
    const result = analyze(text)
    expect(result.matches.length).toBeLessThanOrEqual(3)
  })
})
