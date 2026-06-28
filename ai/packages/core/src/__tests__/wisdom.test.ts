import { expect, describe, it } from "bun:test"
import { Schema, Option, Effect, Layer } from "effect"
import { FSUtil } from "../fs-util"
import { WisdomSchema } from "../wisdom/schema"
import { WisdomExtractor } from "../wisdom/extractor"
import { WisdomService } from "../wisdom/service"

describe("WisdomSchema.WisdomEntry", () => {
  it("parses correctly", () => {
    const decode = Schema.decodeUnknownSync(WisdomSchema.WisdomEntry)
    const result = decode({
      id: "wis_001",
      insight: "Always validate input before processing",
      source: "manual",
      sourceSessionID: "session-123",
      project: "/dev/my-project",
      tags: ["security", "validation"],
      relevance: 0.9,
      createdAt: 1700000000000,
      accessCount: 5,
      lastAccessedAt: 1700000100000,
    })
    expect(result.id).toBe("wis_001")
    expect(result.insight).toBe("Always validate input before processing")
    expect(result.source).toBe("manual")
    expect(result.sourceSessionID).toBe("session-123")
    expect(result.project).toBe("/dev/my-project")
    expect(result.tags).toEqual(["security", "validation"])
    expect(result.relevance).toBe(0.9)
    expect(result.accessCount).toBe(5)
    expect(result.lastAccessedAt).toBeDefined()
  })

  it("rejects relevance outside 0-1", () => {
    const decode = Schema.decodeUnknownSync(WisdomSchema.WisdomEntry)
    expect(() =>
      decode({
        id: "bad",
        insight: "test",
        source: "manual",
        tags: [],
        relevance: 1.5,
        createdAt: 1700000000000,
        accessCount: 0,
      }),
    ).toThrow()
  })

  it("allows missing optional fields", () => {
    const decode = Schema.decodeUnknownSync(WisdomSchema.WisdomEntry)
    const result = decode({
      id: "minimal",
      insight: "test",
      source: "manual",
      tags: [],
      relevance: 0.5,
      createdAt: 1700000000000,
      accessCount: 0,
    })
    expect(result.sourceSessionID).toBeUndefined()
    expect(result.project).toBeUndefined()
    expect(result.lastAccessedAt).toBeUndefined()
  })
})

describe("WisdomSchema.WisdomQuery", () => {
  it("parses with all fields", () => {
    const decode = Schema.decodeUnknownSync(WisdomSchema.WisdomQuery)
    const result = decode({
      project: "/test",
      tags: ["security"],
      limit: 10,
      minRelevance: 0.5,
    })
    expect(result.project).toBe("/test")
    expect(result.tags).toEqual(["security"])
    expect(result.limit).toBe(10)
    expect(result.minRelevance).toBe(0.5)
  })

  it("parses empty query", () => {
    const decode = Schema.decodeUnknownSync(WisdomSchema.WisdomQuery)
    const result = decode({})
    expect(result.project).toBeUndefined()
    expect(result.tags).toBeUndefined()
    expect(result.limit).toBeUndefined()
    expect(result.minRelevance).toBeUndefined()
  })
})

describe("WisdomExtractor.extractFromCompactionSummary", () => {
  it("extracts learnings from sections", () => {
    const entries = WisdomExtractor.extractFromCompactionSummary({
      goal: "Add user auth system",
      keyDecisions: "- Use JWT for token management\n- Store passwords with bcrypt",
      criticalContext: "- Database connection pool is limited to 10 connections\n- Auth service runs on port 3001",
      nextSteps: "- Write unit tests for auth flow\n- Add rate limiting middleware",
    })
    expect(entries.length).toBeGreaterThanOrEqual(5)
    const goalEntry = entries.find((e) => e.insight.includes("Add user auth system"))
    expect(goalEntry).toBeDefined()
    expect(goalEntry!.source).toBe("compaction")
    expect(goalEntry!.tags).toContain("security")

    const decisionEntries = entries.filter((e) => e.tags.includes("decision"))
    expect(decisionEntries.length).toBeGreaterThanOrEqual(1)
  })

  it("handles (none) values gracefully", () => {
    const entries = WisdomExtractor.extractFromCompactionSummary({
      goal: "(none)",
      keyDecisions: "- (none)",
      criticalContext: "(none)",
      nextSteps: "- (none)",
    })
    expect(entries.length).toBe(0)
  })

  it("handles empty summary", () => {
    const entries = WisdomExtractor.extractFromCompactionSummary({})
    expect(entries.length).toBe(0)
  })
})

describe("WisdomExtractor.parseCompactionSummaryText", () => {
  it("parses markdown sections", () => {
    const text = `## Goal
- Implement auth

## Key Decisions
- Use JWT

## Critical Context
- Limited connections

## Next Steps
- Write tests`

    const result = WisdomExtractor.parseCompactionSummaryText(text)
    expect(result.goal).toContain("Implement auth")
    expect(result.keyDecisions).toContain("Use JWT")
    expect(result.criticalContext).toContain("Limited connections")
    expect(result.nextSteps).toContain("Write tests")
  })

  it("handles text without sections", () => {
    const result = WisdomExtractor.parseCompactionSummaryText("Just some text")
    expect(result.goal).toBeUndefined()
    expect(result.keyDecisions).toBeUndefined()
  })
})

describe("WisdomExtractor.extractFromLoopEvidence", () => {
  it("extracts entries from evidence", () => {
    const evidence = [
      { what: "Fixed bug", artifact: "Corrected null pointer in UserService", timestamp: 1700000000000 },
      { what: "Added feature", artifact: "Implemented rate limiting middleware", timestamp: 1700000000000 },
    ]
    const entries = WisdomExtractor.extractFromLoopEvidence(evidence)
    expect(entries).toHaveLength(2)
    expect(entries[0].insight).toContain("Fixed bug")
    expect(entries[0].source).toBe("loop")
  })

  it("handles empty evidence", () => {
    const entries = WisdomExtractor.extractFromLoopEvidence([])
    expect(entries).toHaveLength(0)
  })
})

describe("WisdomExtractor.generateTags", () => {
  it("generates architecture tag", () => {
    const tags = WisdomExtractor.generateTags("The system architecture uses microservices")
    expect(tags).toContain("architecture")
  })

  it("generates bug-fix tag", () => {
    const tags = WisdomExtractor.generateTags("Fixed a bug in the login flow")
    expect(tags).toContain("bug-fix")
  })

  it("generates testing tag", () => {
    const tags = WisdomExtractor.generateTags("Added test coverage for edge cases")
    expect(tags).toContain("testing")
  })

  it("generates multiple tags for mixed content", () => {
    const tags = WisdomExtractor.generateTags("Fixed a performance bug in the API endpoint")
    expect(tags).toContain("bug-fix")
    expect(tags).toContain("performance")
    expect(tags).toContain("api")
  })

  it("includes existing tags", () => {
    const tags = WisdomExtractor.generateTags("Some random insight", ["custom-tag"])
    expect(tags).toContain("custom-tag")
  })

  it("falls back to general tag", () => {
    const tags = WisdomExtractor.generateTags("A completely unrelated note about nothing specific")
    expect(tags).toContain("general")
  })

  it("handles empty string", () => {
    const tags = WisdomExtractor.generateTags("")
    expect(tags).toContain("general")
  })
})

describe("injectWisdom", () => {
  it("formats wisdom entries as XML block", () => {
    const entries = [
      {
        id: "1",
        insight: "Always validate input",
        source: "manual" as const,
        tags: ["security", "validation"],
        relevance: 0.9,
        accessCount: 5,
      },
    ] as any

    const { injectWisdom } = require("../../../talon/src/wisdom/injector") as any
    const result = injectWisdom(entries, "/dev/project")
    expect(result).toBeDefined()
    expect(result).toContain("<accumulated-wisdom>")
    expect(result).toContain("<project>/dev/project</project>")
    expect(result).toContain("<entry")
    expect(result).toContain("Always validate input")
    expect(result).toContain("</accumulated-wisdom>")
  })

  it("returns undefined for empty wisdom", () => {
    const { injectWisdom } = require("../../../talon/src/wisdom/injector") as any
    const result = injectWisdom([])
    expect(result).toBeUndefined()
  })
})

describe("WisdomService add and query", () => {
  it("persists and retrieves entries", async () => {
    const tmpDir = `/tmp/wisdom-test-${Date.now()}`
    const layer = WisdomService.layer(tmpDir)

    const result = await Effect.gen(function* () {
      const service = yield* WisdomService.Service

      const entry1 = yield* service.add({
        insight: "Validation is critical for security",
        source: "manual",
        tags: ["security", "validation"],
        relevance: 0.9,
      })

      const entry2 = yield* service.add({
        insight: "Use JWT for stateless auth",
        source: "manual",
        tags: ["security", "auth"],
        relevance: 0.8,
      })

      const all = yield* service.query({ limit: 10 })
      const security = yield* service.query({ tags: ["auth"], limit: 10 })

      return {
        entry1Id: entry1.id,
        entry2Id: entry2.id,
        allCount: all.length,
        securityCount: security.length,
      }
    }).pipe(
      Effect.provide(layer),
      Effect.provide(FSUtil.defaultLayer),
      Effect.runPromise,
    )

    expect(result.allCount).toBe(2)
    expect(result.securityCount).toBe(1)
  })

  it("get returns correct entry", async () => {
    const tmpDir = `/tmp/wisdom-test-${Date.now()}`
    const layer = WisdomService.layer(tmpDir)

    const result = await Effect.gen(function* () {
      const service = yield* WisdomService.Service
      const entry = yield* service.add({
        insight: "Test insight",
        source: "manual",
        tags: [],
        relevance: 0.5,
      })
      const found = yield* service.get(entry.id)
      const notFound = yield* service.get("nonexistent")
      return {
        found: Option.isSome(found),
        notFound: Option.isNone(notFound),
        insight: Option.isSome(found) ? found.value.insight : "",
      }
    }).pipe(
      Effect.provide(layer),
      Effect.provide(FSUtil.defaultLayer),
      Effect.runPromise,
    )

    expect(result.found).toBe(true)
    expect(result.notFound).toBe(true)
    expect(result.insight).toBe("Test insight")
  })

  it("remove deletes entries", async () => {
    const tmpDir = `/tmp/wisdom-test-${Date.now()}`
    const layer = WisdomService.layer(tmpDir)

    const result = await Effect.gen(function* () {
      const service = yield* WisdomService.Service
      const entry = yield* service.add({
        insight: "To be removed",
        source: "manual",
        tags: [],
        relevance: 0.5,
      })
      yield* service.remove(entry.id)
      const found = yield* service.get(entry.id)
      return Option.isNone(found)
    }).pipe(
      Effect.provide(layer),
      Effect.provide(FSUtil.defaultLayer),
      Effect.runPromise,
    )

    expect(result).toBe(true)
  })

  it("handles unknown tags gracefully", async () => {
    const tmpDir = `/tmp/wisdom-test-${Date.now()}`
    const layer = WisdomService.layer(tmpDir)

    const result = await Effect.gen(function* () {
      const service = yield* WisdomService.Service
      const tags = WisdomExtractor.generateTags("Some random note about nothing specific")
      const entry = yield* service.add({
        insight: "Some random note about nothing specific",
        source: "manual",
        tags,
        relevance: 0.5,
      })
      return { tags: entry.tags }
    }).pipe(
      Effect.provide(layer),
      Effect.provide(FSUtil.defaultLayer),
      Effect.runPromise,
    )

    expect(result.tags).toContain("general")
  })
})
