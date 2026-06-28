import { describe, expect, test } from "bun:test"

function computeCacheSavings(
  cacheReadTokens: number,
  inputPrice: number | undefined,
  cacheReadPrice: number | undefined,
): number | undefined {
  if (inputPrice && cacheReadPrice && cacheReadTokens > 0) {
    const savings = (cacheReadTokens * (inputPrice - cacheReadPrice)) / 1_000_000
    if (savings > 0.001) return savings
  }
  return undefined
}

describe("subagent-footer cache savings", () => {
  test("computes savings when cache read tokens > 0 and pricing available", () => {
    const savings = computeCacheSavings(10_000, 3, 0.3)
    expect(savings).toBe((10_000 * (3 - 0.3)) / 1_000_000)
    expect(savings!).toBeGreaterThan(0.001)
  })

  test("returns undefined when no cache read tokens", () => {
    expect(computeCacheSavings(0, 3, 0.3)).toBeUndefined()
  })

  test("returns undefined when input price is missing", () => {
    expect(computeCacheSavings(10_000, undefined, 0.3)).toBeUndefined()
  })

  test("returns undefined when cache read price is missing", () => {
    expect(computeCacheSavings(10_000, 3, undefined)).toBeUndefined()
  })

  test("returns undefined when savings below $0.001 threshold", () => {
    expect(computeCacheSavings(100, 3, 0.3)).toBeUndefined()
  })

  test("returns undefined when both prices missing", () => {
    expect(computeCacheSavings(10_000, undefined, undefined)).toBeUndefined()
  })

  test("handles large cache savings", () => {
    const savings = computeCacheSavings(1_000_000, 3, 0.3)
    expect(savings).toBe(2.7)
    expect(savings!).toBeGreaterThan(0.001)
  })
})
